// Cell Soup: deterministic, allocation-free simulation and bounded cell VM.
#include "opcodes.h"
#include <stddef.h>
#include <stdint.h>
#define MAX 16384
#define GENOMES 2048
#define CODE 256
#define ARCHIVE 128
#define BONDS 6
#define BOND_LENGTH 18.f
#define CONTACT 10.f
#define W 1600.f
#define H 1000.f
#define FW 128
#define FH 80
#define GRID 20.f
#define GX 80
#define GY 50
#define DT (1.f / 60.f)
#define API __attribute__((visibility("default")))
void *memset(void *p, int v, size_t n) {
  unsigned char *q = p;
  while (n--)
    *q++ = (unsigned char)v;
  return p;
}
void *memcpy(void *d, const void *s, size_t n) {
  unsigned char *a = d;
  const unsigned char *b = s;
  while (n--)
    *a++ = *b++;
  return d;
}
static float minf(float a, float b) { return a < b ? a : b; }
static float maxf(float a, float b) { return a > b ? a : b; }
static float clamp(float x, float a, float b) { return x != x ? a : minf(b, maxf(a, x)); }
static float absf(float x) { return x < 0 ? -x : x; }
static float root(float x) { return __builtin_sqrtf(x); }
// Angles in turns internally; sufficiently accurate smooth polynomial for
// forces/sensing.
static float sinf_(float x) {
  x -= __builtin_floorf(x + .5f);
  float y = 16 * x * (.5f - absf(x));
  return y * (.775f + .225f * absf(y));
}
static float cosf_(float x) { return sinf_(x + .25f); }
static float angle(float x, float y) {
  float a = absf(x), b = absf(y), z = minf(a, b) / maxf(maxf(a, b), .00001f);
  float t = z * (.159155f + (.043f * (1 - z)));
  if (b > a)
    t = .25f - t;
  if (x < 0)
    t = .5f - t;
  if (y < 0)
    t = -t;
  return t;
}
typedef struct {
  int op;
  float a, b, c;
} Ins;
typedef struct {
  Ins code[CODE];
  int len, refs, serial, parent_serial, founder, born_tick, offspring, depth, archived;
} Genome;
typedef struct {
  float x, y, vx, vy, energy, heading, r[8], signal[4], tag, shield, tone, rest, omega,
      anchor[BONDS], inbox[4], pending_mail[4];
  int id, genome, pc, sleep, age, generation, parent, alive, bond[BONDS], next, inbox_from[4],
      pending_from[4];
} Cell;
static Cell cells[MAX];
static Genome genomes[GENOMES];
static Ins upload[CODE];
static float food[FW * FH], scratch[FW * FH];
static int heads[GX * GY], free_slots[MAX], free_n, high, count, tick, births, deaths,
    limit = 8192, budget = 24, next_id = 1;
static uint32_t rng = 1, food_rng = 1;
static float food_process[12], food_memory = 20, food_wander = .22f, food_variation = .4f;
static float mutation = 0, rain = 1, birth_jitter = 12;
API void configure_births(float degrees) { birth_jitter = clamp(degrees, 0, 180); }
// Baseline and full-shield upkeep are per simulated second; others per action.
static float costs[11] = {2, .0005f, 12, .04f, .5f, .08f, .08f, .01f, .72f, .001f, .01f};
API void set_cost(int kind, float value) {
  if (kind >= 0 && kind < 11)
    costs[kind] = clamp(value, 0,
                        kind == 0 || kind == 8 ? 60
                        : kind == 1            ? 10
                        : kind == 2            ? 180
                                               : 200);
}
API int costs_ptr() { return (int)(uintptr_t)costs; }
static Genome archive[ARCHIVE];
static int archive_n, successful_variants, arrival_floor, random_arrivals, sampled_arrivals,
    sampled_mutations, arrival_rate;
static float archive_share = .5f, sample_mutation = .8f;
static int next_genome_id = 1, mutation_counts[4], total_mutations, max_generation;
static float lineage_data[16 * 12], genome_energy[GENOMES];
static int genome_sample[GENOMES];
static int active_genome;
static float render[MAX * 8], lines[MAX * BONDS * 4], inspect_data[32], stats[24];
static int line_count;
static float organism_render[MAX * 8];
static int organism_queue[MAX], organism_seen[MAX];
static uint32_t random_u() {
  rng ^= rng << 13;
  rng ^= rng >> 17;
  rng ^= rng << 5;
  return rng;
}
static float randf() { return (random_u() >> 8) * (1.f / 16777216.f); }
// Food has its own seeded random stream: VM scheduling cannot change its weather.
static float food_random() {
  food_rng ^= food_rng << 13;
  food_rng ^= food_rng >> 17;
  food_rng ^= food_rng << 5;
  return (food_rng >> 8) * (1.f / 16777216.f);
}
// Log for positive normal float32 inputs. Range reduction and an atanh series
// avoid a libc dependency in the freestanding WASM module.
static float log_positive(float x) {
  union {
    float f;
    uint32_t u;
  } bits = {.f = x};
  int exponent = (int)((bits.u >> 23) & 255) - 127;
  bits.u = (bits.u & 0x7fffff) | 0x3f800000;
  float z = (bits.f - 1) / (bits.f + 1), z2 = z * z;
  float term = z, sum = z;
  for (int k = 3; k <= 15; k += 2) {
    term *= z2;
    sum += term / k;
  }
  return exponent * .6931471805599453f + 2 * sum;
}
static float food_normal() {
  float x, y, r;
  do {
    x = 2 * food_random() - 1;
    y = 2 * food_random() - 1;
    r = x * x + y * y;
  } while (r <= .0000001f || r >= 1);
  return x * root(-2 * log_positive(r) / r);
}
API void configure_food(float memory, float wander, float variation) {
  food_memory = clamp(memory, 1, 120);
  food_wander = clamp(wander, 0, 1);
  food_variation = clamp(variation, 0, 1);
  // exp(-0.5 / tau), with |argument| <= 0.5. Taylor error < 6e-9.
  float x = -.5f / food_memory, term = 1, a = 1;
  for (int k = 1; k <= 8; k++) {
    term *= x / k;
    a += term;
  }
  food_process[8] = a;
  food_process[9] = root(maxf(0, 1 - a * a));
}
API int food_process_ptr() { return (int)(uintptr_t)food_process; }
static float dx(float a, float b, float size) {
  float d = a - b;
  if (d > size * .5f)
    d -= size;
  if (d < -size * .5f)
    d += size;
  return d;
}
static float wrap(float x, float size) { return x - __builtin_floorf(x / size) * size; }
static int food_at(float x, float y) {
  return (int)(wrap(y, H) * FH / H) * FW + (int)(wrap(x, W) * FW / W);
}
static int bucket(Cell *c) { return (int)(c->y / GRID) * GX + (int)(c->x / GRID); }
static void grid() {
  for (int k = 0; k < GX * GY; k++)
    heads[k] = -1;
  for (int i = 0; i < high; i++)
    if (cells[i].alive) {
      int k = bucket(&cells[i]);
      cells[i].next = heads[k];
      heads[k] = i;
    }
}
static int degree(Cell *c) {
  int n = 0;
  for (int j = 0; j < BONDS; j++)
    n += c->bond[j] >= 0;
  return n;
}
static void unlink_pair(int a, int b) {
  for (int k = 0; k < BONDS; k++) {
    if (cells[a].bond[k] == b)
      cells[a].bond[k] = -1;
    if (cells[b].bond[k] == a)
      cells[b].bond[k] = -1;
  }
}
static int link_pair(int a, int b) {
  if (a == b || b < 0 || !cells[b].alive)
    return 0;
  int sa = -1, sb = -1;
  for (int k = 0; k < BONDS; k++) {
    if (cells[a].bond[k] == b)
      return 0;
    if (sa < 0 && cells[a].bond[k] < 0)
      sa = k;
    if (sb < 0 && cells[b].bond[k] < 0)
      sb = k;
  }
  if (sa < 0 || sb < 0)
    return 0;
  cells[a].bond[sa] = b;
  cells[b].bond[sb] = a;
  float bearing = angle(dx(cells[b].x, cells[a].x, W), dx(cells[b].y, cells[a].y, H));
  cells[a].anchor[sa] = bearing - cells[a].heading;
  cells[b].anchor[sb] = bearing + .5f - cells[b].heading;
  return 1;
}
static int nearby_filtered(Cell *c, int id, float tag, float cone, float hue, float tolerance) {
  int best = -1;
  int x0 = (int)__builtin_floorf((c->x - 60) / GRID),
      x1 = (int)__builtin_floorf((c->x + 60) / GRID);
  int y0 = (int)__builtin_floorf((c->y - 60) / GRID),
      y1 = (int)__builtin_floorf((c->y + 60) / GRID);
  float dist = 3600, hx = cosf_(c->heading), hy = sinf_(c->heading),
        threshold = cosf_(clamp(cone, 0, 360) / 720);
  for (int by = y0; by <= y1; by++)
    for (int bx = x0; bx <= x1; bx++) {
      int k = ((by + GY) % GY) * GX + (bx + GX) % GX;
      for (int j = heads[k]; j >= 0; j = cells[j].next) {
        Cell *n = &cells[j];
        if (!n->alive || n == c)
          continue;
        if (id > 0 && n->id != id)
          continue;
        if (id == 0 && tag >= 0 && (int)n->tag != (int)tag)
          continue;
        if (hue >= 0 && absf(dx(n->tone * 360, hue, 360)) > tolerance)
          continue;
        float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H), d = x * x + y * y;
        if (d >= dist)
          continue;
        if (cone < 360 && d > .001f && (x * hx + y * hy) / root(d) < threshold)
          continue;
        if (id > 0)
          return j;
        dist = d;
        best = j;
      }
    }
  return best;
}
static int nearby(Cell *c, int id, float tag, float cone) {
  return nearby_filtered(c, id, tag, cone, -1, 180);
}
static float val(Cell *c, float v) { return v <= -1000000.f ? c->r[(int)(-v - 1000000.f) & 7] : v; }
static int reg(float v) { return (int)(-v - 1000000.f) & 7; }
static int alloc_cell(int g, float x, float y, float energy) {
  if (count >= limit || free_n == 0)
    return -1;
  int i = free_slots[--free_n];
  Cell *c = &cells[i];
  memset(c, 0, sizeof(*c));
  c->alive = 1;
  c->id = next_id++;
  c->genome = g;
  genomes[g].refs++;
  c->x = wrap(x, W);
  c->y = wrap(y, H);
  c->energy = energy;
  c->heading = randf();
  c->tone = .43f;
  c->rest = 1;
  for (int k = 0; k < BONDS; k++)
    c->bond[k] = -1;
  count++;
  high = maxf(high, i + 1);
  return i;
}
static int free_genome() {
  for (int g = 0; g < GENOMES; g++)
    if (!genomes[g].refs && g != active_genome)
      return g;
  return -1;
}

// Mutation operates on typed instructions, so every descendant remains a valid
// bounded program.
static float random_operand(char type, int len) {
  static const float constants[] = {-1, 0, 1, 2, 3, 5, 10, 25, 60, 90, 120, .25f, .5f};
  if (type == 'r')
    return -1000000.f - (random_u() % 8);
  if (type == 'l')
    return random_u() % len;
  if (type == 's')
    return random_u() % SENSOR_COUNT;
  if (type == 'p')
    return random_u() % FIELD_COUNT;
  return randf() < .25f ? -1000000.f - (random_u() % 8) : constants[random_u() % 13];
}
static Ins random_instruction(int len, int avoid) {
  Ins in = {0};
  in.op = random_u() % OP_COUNT;
  if (in.op == avoid)
    in.op = (in.op + 1) % OP_COUNT;
  float *values = &in.a;
  for (int k = 0; ARG_TYPES[in.op][k]; k++)
    values[k] = random_operand(ARG_TYPES[in.op][k], len);
  return in;
}
static void retarget(Genome *g, int at, int insertion) {
  for (int i = 0; i < g->len; i++) {
    if (insertion && i == at)
      continue;
    Ins *in = &g->code[i];
    float *args = &in->a;
    for (int k = 0; ARG_TYPES[in->op][k]; k++)
      if (ARG_TYPES[in->op][k] == 'l') {
        int target = (int)args[k];
        if (insertion && target >= at)
          target++;
        if (!insertion && target > at)
          target--;
        args[k] = clamp(target, 0, g->len - 1);
      }
  }
}
static int mutate_genome(Genome *g, Cell *child) {
  float choice = randf();
  int kind = choice < .6f ? 0 : choice < .8f ? 1 : choice < .9f ? 2 : 3;
  int at = random_u() % g->len;
  if (kind == 2 && g->len < CODE) {
    for (int i = g->len; i > at; i--)
      g->code[i] = g->code[i - 1];
    g->len++;
    g->code[at] = random_instruction(g->len, -1);
    retarget(g, at, 1);
    if (child->pc >= at)
      child->pc++;
  } else if (kind == 3 && g->len > 1) {
    for (int i = at; i < g->len - 1; i++)
      g->code[i] = g->code[i + 1];
    g->len--;
    retarget(g, at, 0);
    if (child->pc > at)
      child->pc--;
  } else if (kind == 0 && ARG_TYPES[g->code[at].op][0]) {
    Ins *in = &g->code[at];
    const char *types = ARG_TYPES[in->op];
    int n = 0;
    while (types[n])
      n++;
    int k = random_u() % n;
    float *v = (&in->a) + k, old = *v;
    char type = types[k];
    if (type == 'v' && old > -1000000.f && randf() < .85f) {
      float magnitude = maxf(1, absf(old) * .2f);
      *v = clamp(old + (randf() - .5f) * 2 * magnitude, -999999, 999999);
      if (*v == old)
        *v = old == 999999 ? old - 1 : old + 1;
    } else {
      *v = random_operand(type, g->len);
      if (*v == old) {
        if (type == 'r')
          *v = -1000000.f - (((int)(-old - 1000000) + 1) % 8);
        else if (type == 's')
          *v = ((int)old + 1) % SENSOR_COUNT;
        else if (type == 'p')
          *v = ((int)old + 1) % FIELD_COUNT;
        else if (type == 'l')
          *v = ((int)old + 1) % g->len;
        else
          *v = old <= -1000000.f ? 1 : clamp(old + 1, -999999, 999999);
      }
    }
  } else {
    kind = 1;
    g->code[at] = random_instruction(g->len, g->code[at].op);
  }
  child->pc = (child->pc % g->len + g->len) % g->len;
  mutation_counts[kind]++;
  total_mutations++;
  return kind;
}
// Reservoir sampling gives every qualifying variant a chance at long-term
// retention. Copies survive extinction and genome-slot reuse. Immigration never
// counts as offspring.
static void archive_successes() {
  for (int g = 0; g < GENOMES; g++) {
    Genome *v = &genomes[g];
    if (!v->refs || v->archived || v->offspring < 3 || tick - v->born_tick < 600)
      continue;
    v->archived = 1;
    successful_variants++;
    int slot = archive_n < ARCHIVE ? archive_n++ : random_u() % successful_variants;
    if (slot < ARCHIVE)
      archive[slot] = *v;
  }
}
static int arrive(int n, int random_only) {
  int made = 0;
  while (made < n && count < limit) {
    int g = free_genome();
    if (g < 0)
      break;
    int sampled = !random_only && archive_n && randf() < archive_share;
    Genome *v = &genomes[g];
    if (sampled) {
      *v = archive[random_u() % archive_n];
      v->parent_serial = v->serial;
    } else {
      memset(v, 0, sizeof(*v));
      v->len = 8 + random_u() % 57;
      for (int k = 0; k < v->len; k++)
        v->code[k] = random_instruction(v->len, -1);
    }
    v->serial = next_genome_id++;
    if (!sampled)
      v->founder = v->serial;
    v->refs = v->offspring = v->archived = 0;
    v->born_tick = tick;
    int i = alloc_cell(g, randf() * W, randf() * H, 70);
    if (i < 0)
      break;
    if (sampled && sample_mutation > 0 && randf() < sample_mutation) {
      mutate_genome(v, &cells[i]);
      v->depth++;
      sampled_mutations++;
    }
    // Arrivals start execution at the beginning, including after a structural
    // mutation.
    cells[i].pc = 0;
    cells[i].tone = wrap(v->founder * .618034f + v->depth * .037f, 1);
    if (sampled)
      sampled_arrivals++;
    else
      random_arrivals++;
    made++;
  }
  return made;
}
API void configure_arrivals(int floor, float share, float mut, int rate) {
  arrival_floor = (int)clamp(floor, 0, MAX);
  archive_share = clamp(share, 0, 1);
  sample_mutation = clamp(mut, 0, 1);
  arrival_rate = (int)clamp(rate, 0, 64);
}
API int seed_random(int n) { return arrive((int)clamp(n, 0, MAX), 1); }
static void die(int i) {
  Cell *c = &cells[i];
  for (int k = 0; k < BONDS; k++)
    if (c->bond[k] >= 0)
      unlink_pair(i, c->bond[k]);
  food[food_at(c->x, c->y)] += 4 + maxf(0, c->energy) * .5f;
  c->alive = 0;
  genomes[c->genome].refs--;
  free_slots[free_n++] = i;
  count--;
  deaths++;
}
static int split(int i, int connected, int dst) {
  Cell *p = &cells[i];
  if (p->energy < costs[2] + 20 || count >= limit || (connected && degree(p) >= BONDS)) {
    p->r[dst] = -1;
    return -1;
  }
  int j = alloc_cell(p->genome, p->x + cosf_(p->heading) * 14, p->y + sinf_(p->heading) * 14,
                     (p->energy - costs[2]) * .5f);
  if (j < 0) {
    p->r[dst] = -1;
    return -1;
  }
  Cell *c = &cells[j];
  c->pc = p->pc;
  c->heading =
      wrap(p->heading + (birth_jitter > 0 ? (2 * randf() - 1) * birth_jitter / 360 : 0), 1);
  c->generation = p->generation + 1;
  c->parent = p->id;
  c->tag = p->tag;
  c->tone = p->tone;
  c->shield = p->shield;
  memcpy(c->r, p->r, sizeof(c->r));
  p->energy = c->energy;
  p->r[dst] = 0;
  c->r[dst] = 1;
  c->sleep = 1;
  if (connected)
    link_pair(i, j);
  births++;
  genomes[p->genome].offspring++;
  max_generation = (int)maxf(max_generation, c->generation);
  if (mutation > 0 && randf() < mutation) {
    int g = free_genome();
    if (g >= 0) {
      genomes[g] = genomes[p->genome];
      genomes[g].refs = 1;
      genomes[g].parent_serial = genomes[p->genome].serial;
      genomes[g].serial = next_genome_id++;
      genomes[g].born_tick = tick;
      genomes[g].offspring = 0;
      genomes[g].archived = 0;
      genomes[g].depth++;
      genomes[c->genome].refs--;
      c->genome = g;
      mutate_genome(&genomes[g], c);
      c->tone = wrap(c->tone + .07f, 1);
    }
  }
  return j;
}
// Opcodes are shared with web/language.js. All successful instructions advance
// PC.
static void execute(int i) {
  Cell *c = &cells[i];
  if (c->sleep > 0) {
    c->sleep--;
    return;
  }
  Genome *g = &genomes[c->genome];
  if (!g->len)
    return;
  for (int step = 0; step < budget; step++) {
    if (c->energy <= 0)
      return;
    c->pc = (c->pc % g->len + g->len) % g->len;
    Ins in = g->code[c->pc++];
    float a = val(c, in.a), b = val(c, in.b), v = val(c, in.c);
    int d = reg(in.a), target;
    float amount;
    c->energy -= costs[1];
    switch (in.op) {
    case 0:
      break;
    case 1:
      c->r[d] = b;
      break;
    case 2:
      c->r[d] += b;
      break;
    case 3:
      c->r[d] -= b;
      break;
    case 4:
      c->r[d] *= b;
      break;
    case 5:
      c->r[d] = b == 0 ? 0 : c->r[d] / b;
      break;
    case 6:
      c->r[d] = b == 0 ? 0 : c->r[d] - __builtin_truncf(c->r[d] / b) * b;
      break;
    case 7:
      c->r[d] = randf() * b;
      break;
    case 8:
      c->pc = (int)a;
      break;
    case 9:
      if (a == 0)
        c->pc = (int)b;
      break;
    case 10:
      if (a != 0)
        c->pc = (int)b;
      break;
    case 11:
      if (a > b)
        c->pc = (int)v;
      break;
    case 12:
      if (a < b)
        c->pc = (int)v;
      break;
    case 13:
      if (a == b)
        c->pc = (int)v;
      break;
    case 14:
      c->sleep = (int)clamp(a, 0, 36000);
      return;
    case 15:
      switch ((int)in.b) {
      case 0:
        c->r[d] = c->energy;
        break;
      case 1:
        c->r[d] = food[food_at(c->x, c->y)];
        break;
      case 2:
        c->r[d] = (float)c->age / 60;
        break;
      case 3:
        c->r[d] = degree(c);
        break;
      case 4:
        c->r[d] = c->omega * 360;
        break;
      case 5:
        c->r[d] = c->id;
        break;
      case 6:
        c->r[d] = c->generation;
        break;
      case 7:
        c->r[d] = c->tag;
        break;
      case 8:
        c->r[d] = food[food_at(c->x + cosf_(c->heading) * 25, c->y + sinf_(c->heading) * 25)];
        break;
      case 9:
        c->r[d] = food[food_at(c->x + cosf_(c->heading - .125f) * 25,
                               c->y + sinf_(c->heading - .125f) * 25)];
        break;
      case 10:
        c->r[d] = food[food_at(c->x + cosf_(c->heading + .125f) * 25,
                               c->y + sinf_(c->heading + .125f) * 25)];
        break;
      case 11:
        c->r[d] = c->tone * 360;
        break;
      }
      break;
    case 16:
      target = nearby(c, 0, b, clamp(v, 0, 360));
      c->r[d] = target < 0 ? 0 : cells[target].id;
      break;
    case 17:
      target = b > 0 ? nearby(c, (int)b, -1, 360) : -1;
      c->r[d] = 0;
      if (target >= 0) {
        Cell *n = &cells[target];
        float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H);
        switch ((int)in.c) {
        case 0:
          c->r[d] = n->energy;
          break;
        case 1:
          c->r[d] = n->tag;
          break;
        case 2:
          c->r[d] = root(x * x + y * y);
          break;
        case 3:
          c->r[d] = wrap(angle(x, y) - c->heading + .5f, 1) * 360 - 180;
          break;
        case 4:
          c->r[d] = n->genome == c->genome;
          break;
        case 5:
          c->r[d] = n->shield;
          break;
        case 6:
          c->r[d] = degree(n);
          break;
        case 7:
          c->r[d] = n->tone * 360;
          break;
        }
      }
      break;
    case 18:
    case 19:
      split(i, in.op == 19, d);
      return;
    case 20:
      amount = clamp(a, -360, 360);
      if (c->energy >= absf(amount) * costs[9]) {
        c->energy -= absf(amount) * costs[9];
        c->heading = wrap(c->heading + amount / 360, 1);
      }
      break;
    case 21:
      amount = clamp(a, -1, 1);
      if (c->energy >= absf(amount) * costs[3]) {
        c->energy -= absf(amount) * costs[3];
        c->vx += cosf_(c->heading) * amount * 5;
        c->vy += sinf_(c->heading) * amount * 5;
      }
      break;
    case 22:
      target = a > 0 ? nearby(c, (int)a, -1, 360) : -1;
      if (target >= 0 && c->energy >= costs[4]) {
        float x = dx(cells[target].x, c->x, W), y = dx(cells[target].y, c->y, H);
        if (x * x + y * y < 24 * 24 && link_pair(i, target))
          c->energy -= costs[4];
      }
      break;
    case 23:
      if (a == 0) {
        for (int k = 0; k < BONDS; k++)
          if (c->bond[k] >= 0)
            unlink_pair(i, c->bond[k]);
      } else
        for (int k = 0; k < BONDS; k++)
          if (c->bond[k] >= 0 && cells[c->bond[k]].id == (int)a)
            unlink_pair(i, c->bond[k]);
      break;
    case 24:
      if (c->energy >= costs[5]) {
        c->energy -= costs[5];
        c->rest = clamp(a, .55f, 1.5f);
      }
      break;
    case 25:
    case 26:
      target = a > 0 ? nearby(c, (int)a, -1, 360) : -1;
      if (target >= 0) {
        Cell *n = &cells[target];
        float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H);
        if (x * x + y * y <= 18 * 18) {
          if (in.op == 25 && c->energy >= costs[6]) {
            c->energy -= costs[6];
            amount = minf(clamp(b, 0, 3) * (1 - n->shield * .9f),
                          minf(maxf(0, n->energy), maxf(0, 200 - c->energy) / .75f));
            n->energy -= amount;
            c->energy += amount * .75f;
          }
          if (in.op == 26) {
            amount = minf(clamp(b, 0, 10), minf(maxf(0, c->energy), maxf(0, 200 - n->energy)));
            c->energy -= amount;
            n->energy += amount;
          }
        }
      }
      break;
    case 27:
      c->tag = (int)clamp(a, 0, 255);
      break;
    case 28:
      c->shield = clamp(a, 0, 1);
      break;
    case 29:
      c->tone = wrap(a / 360, 1);
      break;
    case 30:
      if (c->energy >= costs[7]) {
        c->energy -= costs[7];
        c->signal[(int)clamp(a, 0, 3)] = clamp(b, -100, 100);
      }
      break;
    case 31: {
      c->r[d] = 0;
      int x0 = (int)__builtin_floorf((c->x - 60) / GRID),
          x1 = (int)__builtin_floorf((c->x + 60) / GRID);
      int y0 = (int)__builtin_floorf((c->y - 60) / GRID),
          y1 = (int)__builtin_floorf((c->y + 60) / GRID);
      for (int by = y0; by <= y1; by++)
        for (int bx = x0; bx <= x1; bx++)
          for (int j = heads[((by + GY) % GY) * GX + (bx + GX) % GX]; j >= 0; j = cells[j].next) {
            Cell *n = &cells[j];
            float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H);
            if (n != c && n->alive && x * x + y * y < 3600)
              c->r[d] += n->signal[(int)clamp(b, 0, 3)] * (1 - root(x * x + y * y) / 60);
          }
    } break;
    case 32:
      c->r[d] = absf(b);
      break;
    case 33:
      c->r[d] = minf(c->r[d], b);
      break;
    case 34:
      c->r[d] = maxf(c->r[d], b);
      break;
    case 35: {
      float hx = cosf_(c->heading) * 25, hy = sinf_(c->heading) * 25;
      float forward = food[food_at(c->x + hx, c->y + hy)] - food[food_at(c->x - hx, c->y - hy)];
      float right = food[food_at(c->x - hy, c->y + hx)] - food[food_at(c->x + hy, c->y - hx)];
      c->r[d] = wrap(angle(forward, right) + .5f, 1) * 360 - 180;
      c->r[reg(in.b)] = root(forward * forward + right * right) / 50;
      break;
    }
    case 36:
      target = nearby_filtered(c, 0, -1, 360, wrap(b, 360), clamp(v, 0, 180));
      c->r[d] = target < 0 ? 0 : cells[target].id;
      break;
    case 37:
      target = b >= 0 && b < BONDS ? c->bond[(int)b] : -1;
      c->r[d] = target >= 0 && cells[target].alive ? cells[target].id : 0;
      break;
    case 38: {
      int channel = (int)clamp(b, 0, 3);
      for (int k = 0; k < BONDS; k++) {
        int j = c->bond[k];
        if (j < 0 || !cells[j].alive || (a != 0 && (int)a != cells[j].id))
          continue;
        if (c->energy < costs[10])
          break;
        c->energy -= costs[10];
        cells[j].pending_mail[channel] = clamp(v, -100, 100);
        cells[j].pending_from[channel] = c->id;
      }
      break;
    }
    case 39: {
      int channel = (int)clamp(v, 0, 3);
      c->r[d] = c->inbox_from[channel] ? c->inbox[channel] : 0;
      c->r[reg(in.b)] = c->inbox_from[channel];
      c->inbox[channel] = 0;
      c->inbox_from[channel] = 0;
      break;
    }
    }
    for (int k = 0; k < 8; k++)
      c->r[k] = clamp(c->r[k], -999999, 999999);
  }
}
API int upload_ptr() { return (int)(uintptr_t)upload; }
API int load_program(int len) {
  if (len < 1 || len > CODE)
    return -1;
  int g = free_genome();
  if (g < 0)
    return -1;
  genomes[g].len = len;
  genomes[g].serial = next_genome_id++;
  genomes[g].parent_serial = 0;
  genomes[g].founder = genomes[g].serial;
  genomes[g].born_tick = tick;
  genomes[g].offspring = 0;
  genomes[g].archived = 0;
  genomes[g].depth = 0;
  genomes[g].refs = 0;
  memcpy(genomes[g].code, upload, len * sizeof(Ins));
  active_genome = g;
  return g;
}
API void configure(int steps, int cap, float mut, float feed) {
  budget = (int)clamp(steps, 1, 128);
  limit = (int)clamp(cap, 1, MAX);
  mutation = clamp(mut, 0, 1);
  rain = clamp(feed, 0, 5);
}
API void add_food(float x, float y, float strength) {
  for (int oy = -7; oy <= 7; oy++)
    for (int ox = -7; ox <= 7; ox++) {
      float f = maxf(0, 1 - (ox * ox + oy * oy) / 49.f);
      int k = food_at(x + ox * W / FW, y + oy * H / FH);
      food[k] = minf(80, food[k] + strength * f * f);
    }
}
API int seed_cells(int n, float x, float y, float spread, int g) {
  if (g < 0 || g >= GENOMES || genomes[g].len == 0)
    return 0;
  int made = 0;
  for (int k = 0; k < n; k++) {
    float a = randf(), r = root(randf()) * spread;
    if (alloc_cell(g, x + cosf_(a) * r, y + sinf_(a) * r, 70) >= 0)
      made++;
    else
      break;
  }
  return made;
}
API void reset(int seed) {
  memset(cells, 0, sizeof(cells));
  memset(genomes, 0, sizeof(genomes));
  memset(food, 0, sizeof(food));
  free_n = MAX;
  for (int i = 0; i < MAX; i++)
    free_slots[i] = MAX - 1 - i;
  high = count = tick = births = deaths = 0;
  next_id = 1;
  next_genome_id = 1;
  total_mutations = max_generation = 0;
  memset(mutation_counts, 0, sizeof(mutation_counts));
  active_genome = -1;
  archive_n = successful_variants = random_arrivals = sampled_arrivals = sampled_mutations = 0;
  memset(archive, 0, sizeof(archive));
  rng = seed ? seed : 1;
  food_rng = rng ^ 0x9e3779b9u;
  if (!food_rng)
    food_rng = 1;
  memset(food_process, 0, sizeof(food_process));
  food_process[0] = food_random() * W;
  food_process[1] = food_random() * H;
  configure_food(food_memory, food_wander, food_variation);
  for (int k = 0; k < 20; k++)
    add_food(randf() * W, randf() * H, 12);
  grid();
}
static void tick_once() {
  tick++;
  if (tick % 30 == 0) {
    float a = food_process[8], b = food_process[9];
    // Exact OU transition law at the fixed half-second drop interval.
    food_process[2] = a * food_process[2] + b * food_wander * W * food_normal();
    food_process[3] = a * food_process[3] + b * food_wander * H * food_normal();
    food_process[4] = a * food_process[4] + b * food_variation * food_normal();
    food_process[5] = wrap(food_process[0] + food_process[2], W);
    food_process[6] = wrap(food_process[1] + food_process[3], H);
    food_process[7] = 8 * rain * clamp(1 + food_process[4], 0, 3);
    food_process[10] += food_process[7] > 0;
    food_process[11] = tick;
    if (food_process[7] > 0)
      add_food(food_process[5], food_process[6], food_process[7]);
  }
  if (tick % 4 == 0) {
    for (int y = 0; y < FH; y++)
      for (int x = 0; x < FW; x++) {
        int k = y * FW + x;
        float avg = food[y * FW + (x + 1) % FW] + food[y * FW + (x + FW - 1) % FW] +
                    food[((y + 1) % FH) * FW + x] + food[((y + FH - 1) % FH) * FW + x];
        scratch[k] = (food[k] + .12f * (avg - 4 * food[k])) * .9995f;
      }
    memcpy(food, scratch, sizeof(food));
  }
  grid();
  int original_high = high;
  int cutoff = next_id;
  // All cells sample this tick's food before any program runs. Newborns start
  // next tick.
  for (int i = 0; i < original_high; i++) {
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    int k = food_at(c->x, c->y);
    float uptake = minf(food[k], minf(.16f, maxf(0, 200 - c->energy)));
    food[k] -= uptake;
    c->energy += uptake;
    c->energy -= (costs[0] + c->shield * costs[8]) * DT;
    c->age++;
    for (int q = 0; q < 4; q++) {
      c->signal[q] *= .97f;
      if (c->pending_from[q]) {
        c->inbox[q] = c->pending_mail[q];
        c->inbox_from[q] = c->pending_from[q];
        c->pending_from[q] = 0;
      }
    }
  }
  for (int offset = 0; offset < original_high; offset++) {
    int i = (offset + tick) % original_high;
    if (cells[i].alive && cells[i].id < cutoff)
      execute(i);
  }
  grid();
  for (int i = 0; i < high; i++) {
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    // Broad phase buckets, short-range soft-disc collisions, damped spring
    // bonds.
    int x0 = (int)__builtin_floorf((c->x - CONTACT) / GRID),
        x1 = (int)__builtin_floorf((c->x + CONTACT) / GRID);
    int y0 = (int)__builtin_floorf((c->y - CONTACT) / GRID),
        y1 = (int)__builtin_floorf((c->y + CONTACT) / GRID);
    for (int by = y0; by <= y1; by++)
      for (int bx = x0; bx <= x1; bx++)
        for (int j = heads[((by + GY) % GY) * GX + (bx + GX) % GX]; j >= 0; j = cells[j].next) {
          if (j <= i)
            continue;
          Cell *n = &cells[j];
          float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H), dist2 = x * x + y * y;
          if (dist2 < CONTACT * CONTACT) {
            if (dist2 < .0001f) {
              x = .01f;
              dist2 = .0001f;
            }
            float dist = root(dist2), force = (CONTACT - dist) * 55 * DT / dist;
            c->vx -= x * force;
            c->vy -= y * force;
            n->vx += x * force;
            n->vy += y * force;
          }
        }
    for (int k = 0; k < BONDS; k++) {
      int j = c->bond[k];
      if (j <= i)
        continue;
      Cell *n = &cells[j];
      float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H), dist = root(x * x + y * y);
      if (dist > 65) {
        unlink_pair(i, j);
        continue;
      }
      int other = 0;
      while (other < BONDS && n->bond[other] != i)
        other++;
      if (other == BONDS)
        continue;
      // Spring attachment points rotate with each cell, at radius 3 inside its rim.
      // Equal/opposite endpoint forces induce both translation and passive torque.
      float ca = c->heading + c->anchor[k], na = n->heading + n->anchor[other];
      float cx = 3 * cosf_(ca), cy = 3 * sinf_(ca);
      float nx = 3 * cosf_(na), ny = 3 * sinf_(na);
      x += nx - cx;
      y += ny - cy;
      dist = root(x * x + y * y);
      float rest = maxf(.5f, BOND_LENGTH * (c->rest + n->rest) * .5f - 6);
      float force = (dist - rest) * 24 * DT / maxf(dist, .01f);
      float fx = x * force, fy = y * force;
      c->vx += fx;
      c->vy += fy;
      n->vx -= fx;
      n->vy -= fy;
      // Uniform radius-4 unit-mass discs: I=8, convert radians to turns.
      c->omega += (cx * fy - cy * fx) * .019894368f;
      n->omega -= (nx * fy - ny * fx) * .019894368f;
      float flow = (c->energy - n->energy) * .012f;
      if (flow > 0)
        flow = minf(flow, maxf(0, c->energy));
      else
        flow = -minf(-flow, maxf(0, n->energy));
      c->energy -= flow;
      n->energy += flow;
    }
  }
  for (int i = 0; i < high; i++) {
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    if (c->energy <= 0) {
      die(i);
      continue;
    }
    c->omega = clamp(c->omega * .94f, -2, 2);
    c->heading = wrap(c->heading + c->omega * DT, 1);
    c->vx = clamp(c->vx * .94f, -100, 100);
    c->vy = clamp(c->vy * .94f, -100, 100);
    c->x = wrap(c->x + c->vx * DT, W);
    c->y = wrap(c->y + c->vy * DT, H);
  }
  if (tick % 60 == 0) {
    archive_successes();
    int missing = (int)minf(arrival_floor, limit) - count;
    int arrivals = arrival_rate + (int)clamp(missing, 0, 64);
    if (arrivals > 0)
      arrive(arrivals, 0);
  }
}
API void step(int n) {
  n = (int)clamp(n, 0, 600);
  while (n--)
    tick_once();
}
API int snapshot() {
  int n = 0;
  line_count = 0;
  float energy = 0;
  memset(genome_energy, 0, sizeof(genome_energy));
  for (int i = 0; i < high; i++) {
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    float *r = render + n * 8;
    r[0] = c->x;
    r[1] = c->y;
    r[2] = c->energy;
    r[3] = c->tone;
    r[4] = c->id;
    r[5] = c->shield;
    r[6] = c->heading;
    r[7] = wrap(genomes[c->genome].founder * .618034f + genomes[c->genome].depth * .037f, 1);
    genome_energy[c->genome] += c->energy;
    genome_sample[c->genome] = c->id;
    n++;
    energy += c->energy;
    for (int k = 0; k < BONDS; k++) {
      int j = c->bond[k];
      if (j <= i)
        continue;
      Cell *b = &cells[j];
      float *l = lines + line_count * 4;
      int other = 0;
      while (other < BONDS && b->bond[other] != i)
        other++;
      float ca = c->heading + c->anchor[k];
      float ba = b->heading + b->anchor[other < BONDS ? other : 0];
      l[0] = c->x + 3 * cosf_(ca);
      l[1] = c->y + 3 * sinf_(ca);
      l[2] = c->x + dx(b->x, c->x, W) + 3 * cosf_(ba);
      l[3] = c->y + dx(b->y, c->y, H) + 3 * sinf_(ba);
      line_count++;
    }
  }
  stats[0] = n;
  stats[1] = tick;
  stats[2] = births;
  stats[3] = deaths;
  stats[4] = line_count;
  stats[5] = n ? energy / n : 0;
  stats[6] = energy;
  int gs = 0;
  for (int g = 0; g < GENOMES; g++)
    gs += genomes[g].refs > 0;
  stats[7] = gs;
  stats[8] = total_mutations;
  stats[17] = random_arrivals;
  stats[18] = sampled_arrivals;
  stats[19] = archive_n;
  stats[20] = sampled_mutations;
  stats[21] = total_mutations - sampled_mutations;
  stats[22] = minf(arrival_floor, limit);
  stats[23] = successful_variants;
  stats[9] = max_generation;
  stats[10] = 0;
  stats[11] = next_genome_id - 1;
  for (int k = 0; k < 4; k++)
    stats[12 + k] = mutation_counts[k];
  for (int g = 0; g < GENOMES; g++)
    if (genomes[g].refs > 0)
      stats[10] = maxf(stats[10], genomes[g].depth);
  int top[16];
  for (int k = 0; k < 16; k++)
    top[k] = -1;
  for (int g = 0; g < GENOMES; g++)
    if (genomes[g].refs > 0)
      for (int k = 0; k < 16; k++)
        if (top[k] < 0 || genomes[g].refs > genomes[top[k]].refs) {
          for (int j = 15; j > k; j--)
            top[j] = top[j - 1];
          top[k] = g;
          break;
        }
  int rows = 0;
  for (int k = 0; k < 16; k++) {
    int g = top[k];
    if (g < 0)
      break;
    Genome *v = &genomes[g];
    float *r = lineage_data + k * 12;
    r[0] = v->serial;
    r[1] = v->parent_serial;
    r[2] = v->founder;
    r[3] = v->refs;
    r[4] = v->offspring;
    r[5] = v->born_tick;
    r[6] = v->depth;
    r[7] = v->len;
    r[8] = genome_energy[g] / v->refs;
    r[9] = genome_sample[g];
    r[10] = g;
    r[11] = wrap(v->founder * .618034f + v->depth * .037f, 1);
    rows++;
  }
  stats[16] = rows;
  return n;
}
API int lineages_ptr() { return (int)(uintptr_t)lineage_data; }
API int render_ptr() { return (int)(uintptr_t)render; }
API int lines_ptr() { return (int)(uintptr_t)lines; }
API int food_ptr() { return (int)(uintptr_t)food; }
API int stats_ptr() { return (int)(uintptr_t)stats; }
static void inspect_organism(int start) {
  memset(organism_seen, 0, sizeof(organism_seen));
  int n = 1, read = 0;
  float energy = 0, minx = cells[start].x, maxx = minx, miny = cells[start].y, maxy = miny;
  organism_queue[0] = start;
  organism_seen[start] = 1;
  organism_render[0] = minx;
  organism_render[1] = miny;
  while (read < n) {
    int slot = organism_queue[read];
    Cell *c = &cells[slot];
    float *r = organism_render + read * 8;
    r[2] = c->energy;
    r[3] = c->tone;
    r[4] = c->id;
    r[5] = c->shield;
    r[6] = c->heading;
    r[7] = wrap(genomes[c->genome].founder * .618034f + genomes[c->genome].depth * .037f, 1);
    energy += c->energy;
    minx = minf(minx, r[0]);
    maxx = maxf(maxx, r[0]);
    miny = minf(miny, r[1]);
    maxy = maxf(maxy, r[1]);
    for (int k = 0; k < BONDS; k++) {
      int j = c->bond[k];
      if (j < 0 || organism_seen[j] || !cells[j].alive)
        continue;
      organism_seen[j] = 1;
      organism_queue[n] = j;
      organism_render[n * 8] = r[0] + dx(cells[j].x, c->x, W);
      organism_render[n * 8 + 1] = r[1] + dx(cells[j].y, c->y, H);
      n++;
    }
    read++;
  }
  inspect_data[24] = n;
  inspect_data[25] = energy;
  inspect_data[26] = (minx + maxx) * .5f;
  inspect_data[27] = (miny + maxy) * .5f;
  inspect_data[28] = maxx - minx + 8;
  inspect_data[29] = maxy - miny + 8;
  inspect_data[30] = cells[start].x;
  inspect_data[31] = cells[start].y;
}
API int organism_ptr() { return (int)(uintptr_t)organism_render; }
API int inspect(int id) {
  for (int i = 0; i < high; i++)
    if (cells[i].alive && cells[i].id == id) {
      Cell *c = &cells[i];
      inspect_data[0] = c->id;
      inspect_data[1] = c->energy;
      inspect_data[2] = c->pc % genomes[c->genome].len;
      inspect_data[3] = c->age / 60.f;
      inspect_data[4] = c->generation;
      inspect_data[5] = degree(c);
      inspect_data[6] = c->tag;
      inspect_data[7] = c->shield;
      inspect_data[8] = c->genome;
      inspect_data[9] = c->parent;
      for (int k = 0; k < 8; k++)
        inspect_data[10 + k] = c->r[k];
      Genome *g = &genomes[c->genome];
      inspect_data[18] = g->serial;
      inspect_data[19] = g->parent_serial;
      inspect_data[20] = g->founder;
      inspect_data[21] = g->depth;
      inspect_data[22] = g->born_tick;
      inspect_data[23] = g->offspring;
      inspect_organism(i);
      return (int)(uintptr_t)inspect_data;
    }
  return 0;
}
API int genome_ptr(int g) { return g >= 0 && g < GENOMES ? (int)(uintptr_t)genomes[g].code : 0; }
API int genome_len(int g) { return g >= 0 && g < GENOMES ? genomes[g].len : 0; }
