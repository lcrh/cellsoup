// Cell Soup: deterministic, allocation-free simulation and bounded cell VM.
#include "opcodes.h"
#include <stddef.h>
#include <stdint.h>
#define MAX 16384
#define GENOMES 2048
#define CODE 256
#define BONDS 6
#define W 1600.f
#define H 1000.f
#define FW 128
#define FH 80
#define GX 40
#define GY 25
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
// Angles in turns internally; sufficiently accurate smooth polynomial for forces/sensing.
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
  int len, refs, serial, parent_serial, founder, born_tick, offspring, depth;
} Genome;
typedef struct {
  float x, y, vx, vy, energy, heading, r[8], signal[4], tag, shield, tone, rest;
  int id, genome, pc, sleep, age, generation, parent, alive, bond[BONDS], next;
} Cell;
static Cell cells[MAX];
static Genome genomes[GENOMES];
static Ins upload[CODE];
static float food[FW * FH], scratch[FW * FH];
static int heads[GX * GY], free_slots[MAX], free_n, high, count, tick, births, deaths,
    limit = 8192, budget = 24, next_id = 1;
static uint32_t rng = 1;
static float mutation = .05f, rain = 1;
static int next_genome_id = 1, mutation_counts[4], total_mutations, max_generation;
static float lineage_data[16 * 12], genome_energy[GENOMES];
static int genome_sample[GENOMES];
static int active_genome;
static float render[MAX * 8], lines[MAX * BONDS * 4], inspect_data[32], stats[24];
static int line_count;
static uint32_t random_u() {
  rng ^= rng << 13;
  rng ^= rng >> 17;
  rng ^= rng << 5;
  return rng;
}
static float randf() { return (random_u() >> 8) * (1.f / 16777216.f); }
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
static int bucket(Cell *c) { return (int)(c->y / 40) * GX + (int)(c->x / 40); }
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
    if (cells[a].bond[k] < 0)
      sa = k;
    if (cells[b].bond[k] < 0)
      sb = k;
  }
  if (sa < 0 || sb < 0)
    return 0;
  cells[a].bond[sa] = b;
  cells[b].bond[sb] = a;
  return 1;
}
static int nearby(Cell *c, int id, float tag, float cone) {
  int bx = (int)(c->x / 40), by = (int)(c->y / 40), best = -1;
  float dist = 60 * 60;
  for (int oy = -2; oy <= 2; oy++)
    for (int ox = -2; ox <= 2; ox++) {
      int k = ((by + oy + GY) % GY) * GX + (bx + ox + GX) % GX;
      for (int j = heads[k]; j >= 0; j = cells[j].next) {
        Cell *n = &cells[j];
        if (!n->alive || n == c)
          continue;
        if (id > 0 && n->id != id)
          continue;
        if (id == 0 && tag >= 0 && (int)n->tag != (int)tag)
          continue;
        float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H), d = x * x + y * y;
        if (d >= dist)
          continue;
        if (cone < 360 && d > .001f &&
            (x * cosf_(c->heading) + y * sinf_(c->heading)) / root(d) <
                cosf_(clamp(cone, 0, 360) / 720))
          continue;
        dist = d;
        best = j;
      }
    }
  return best;
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

// Mutation operates on typed instructions, so every descendant remains a valid bounded program.
static float random_operand(char type, int len) {
  static const float constants[] = {-1, 0, 1, 2, 3, 5, 10, 25, 60, 90, 120, .25f, .5f};
  if (type == 'r')
    return -1000000.f - (random_u() % 8);
  if (type == 'l')
    return random_u() % len;
  if (type == 's')
    return random_u() % 11;
  if (type == 'p')
    return random_u() % 7;
  return randf() < .25f ? -1000000.f - (random_u() % 8) : constants[random_u() % 13];
}
static Ins random_instruction(int len, int avoid) {
  Ins in = {0};
  in.op = random_u() % 35;
  if (in.op == avoid)
    in.op = (in.op + 1) % 35;
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
          *v = ((int)old + 1) % 11;
        else if (type == 'p')
          *v = ((int)old + 1) % 7;
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
  if (p->energy < 32 || count >= limit || (connected && degree(p) >= BONDS)) {
    p->r[dst] = -1;
    return -1;
  }
  int j = alloc_cell(p->genome, p->x + cosf_(p->heading) * 9, p->y + sinf_(p->heading) * 9,
                     (p->energy - 12) * .5f);
  if (j < 0) {
    p->r[dst] = -1;
    return -1;
  }
  Cell *c = &cells[j];
  c->pc = p->pc;
  c->heading = p->heading + .5f;
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
      genomes[g].depth++;
      genomes[c->genome].refs--;
      c->genome = g;
      mutate_genome(&genomes[g], c);
      c->tone = wrap(c->tone + .07f, 1);
    }
  }
  return j;
}
// Opcodes are shared with web/language.js. All successful instructions advance PC.
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
    c->energy -= .0005f;
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
        c->r[d] = wrap(c->heading, 1) * 360;
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
        }
      }
      break;
    case 18:
    case 19:
      split(i, in.op == 19, d);
      return;
    case 20:
      c->heading = wrap(c->heading + clamp(a, -360, 360) / 360, 1);
      break;
    case 21:
      amount = clamp(a, -1, 1);
      if (c->energy >= absf(amount) * .04f) {
        c->energy -= absf(amount) * .04f;
        c->vx += cosf_(c->heading) * amount * 5;
        c->vy += sinf_(c->heading) * amount * 5;
      }
      break;
    case 22:
      target = a > 0 ? nearby(c, (int)a, -1, 360) : -1;
      if (target >= 0 && c->energy >= .5f) {
        float x = dx(cells[target].x, c->x, W), y = dx(cells[target].y, c->y, H);
        if (x * x + y * y < 24 * 24 && link_pair(i, target))
          c->energy -= .5f;
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
      if (c->energy >= .08f) {
        c->energy -= .08f;
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
          if (in.op == 25 && c->energy >= .08f) {
            c->energy -= .08f;
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
      if (c->energy >= .01f) {
        c->energy -= .01f;
        c->signal[(int)clamp(a, 0, 3)] = clamp(b, -100, 100);
      }
      break;
    case 31: {
      c->r[d] = 0;
      int bx = (int)(c->x / 40), by = (int)(c->y / 40);
      for (int oy = -2; oy <= 2; oy++)
        for (int ox = -2; ox <= 2; ox++)
          for (int j = heads[((by + oy + GY) % GY) * GX + (bx + ox + GX) % GX]; j >= 0;
               j = cells[j].next) {
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
  rng = seed ? seed : 1;
  for (int k = 0; k < 20; k++)
    add_food(randf() * W, randf() * H, 12);
  grid();
}
static void tick_once() {
  tick++;
  if (rain > 0 && tick % 30 == 0)
    add_food(randf() * W, randf() * H, 8 * rain);
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
  // All cells sample this tick's food before any program runs. Newborns start next tick.
  for (int i = 0; i < original_high; i++) {
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    int k = food_at(c->x, c->y);
    float uptake = minf(food[k], minf(.16f, maxf(0, 200 - c->energy)));
    food[k] -= uptake;
    c->energy += uptake;
    c->energy -= .004f + c->shield * .012f;
    c->age++;
    for (int q = 0; q < 4; q++)
      c->signal[q] *= .97f;
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
    // Broad phase buckets, short-range soft-disc collisions, damped spring bonds.
    int bx = (int)(c->x / 40), by = (int)(c->y / 40);
    for (int oy = -1; oy <= 1; oy++)
      for (int ox = -1; ox <= 1; ox++)
        for (int j = heads[((by + oy + GY) % GY) * GX + (bx + ox + GX) % GX]; j >= 0;
             j = cells[j].next) {
          if (j <= i)
            continue;
          Cell *n = &cells[j];
          float x = dx(n->x, c->x, W), y = dx(n->y, c->y, H), dist2 = x * x + y * y;
          if (dist2 < 64) {
            if (dist2 < .0001f) {
              x = .01f;
              dist2 = .0001f;
            }
            float dist = root(dist2), force = (8 - dist) * 35 * DT / dist;
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
      float force = (dist - 12 * (c->rest + n->rest) * .5f) * 24 * DT / maxf(dist, .01f);
      c->vx += x * force;
      c->vy += y * force;
      n->vx -= x * force;
      n->vy -= y * force;
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
    c->vx = clamp(c->vx * .94f, -100, 100);
    c->vy = clamp(c->vy * .94f, -100, 100);
    c->x = wrap(c->x + c->vx * DT, W);
    c->y = wrap(c->y + c->vy * DT, H);
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
      l[0] = c->x;
      l[1] = c->y;
      l[2] = c->x + dx(b->x, c->x, W);
      l[3] = c->y + dx(b->y, c->y, H);
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
      return (int)(uintptr_t)inspect_data;
    }
  return 0;
}
API int genome_ptr(int g) { return g >= 0 && g < GENOMES ? (int)(uintptr_t)genomes[g].code : 0; }
API int genome_len(int g) { return g >= 0 && g < GENOMES ? genomes[g].len : 0; }
