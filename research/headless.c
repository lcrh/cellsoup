// Instrumented native build of the browser's exact simulation source.
// Disable FP contraction: the WASM reference uses separate multiply/add operations.
#define CELLSOUP_RESEARCH
#include "../src/engine.c"
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

static int components[MAX], sizes[MAX];
static int find_component(int i) {
  while (components[i] != i) {
    components[i] = components[components[i]];
    i = components[i];
  }
  return i;
}
static void sample(void) {
  snapshot();
  for (int i = 0; i < high; i++) {
    components[i] = i;
    sizes[i] = 0;
  }
  for (int i = 0; i < high; i++)
    if (cells[i].alive)
      for (int k = 0; k < BONDS; k++)
        if (cells[i].bond[k] >= 0) {
          int a = find_component(i), b = find_component(cells[i].bond[k]);
          components[b] = a;
        }
  for (int i = 0; i < high; i++)
    if (cells[i].alive)
      sizes[find_component(i)]++;
  int bodies = 0, largest = 0, linked = 0, mature = 0, descendants = 0, maxgen = 0;
  double age = 0;
  for (int i = 0; i < high; i++) {
    if (sizes[i]) {
      bodies++;
      if (sizes[i] > largest)
        largest = sizes[i];
    }
    Cell *c = &cells[i];
    if (!c->alive)
      continue;
    linked += sizes[find_component(i)] > 1;
    mature += c->age >= 60 * 60;
    descendants += c->generation > 0;
    if (c->generation > maxgen)
      maxgen = c->generation;
    age += c->age / 60.;
  }
  printf("{\"type\":\"sample\",\"seconds\":%.0f,\"cells\":%d,\"bodies\":%d,\"largestBody\":%d,"
         "\"linkedCells\":%d,\"matureCells\":%d,\"descendants\":%d,\"livingMaxGeneration\":%d,"
         "\"meanAge\":%.4f,\"births\":%d,\"deaths\":%d,\"archive\":%d,\"importedEnergy\":%.6f,"
         "\"foodAdded\":%.6f,\"absorbedEnergy\":%.6f,\"totalEnergy\":%.6f}\n",
         tick / 60., count, bodies, largest, linked, mature, descendants, maxgen,
         count ? age / count : 0, births, deaths, archive_n, research_imported, research_food_added,
         research_absorbed, stats[6]);
  fflush(stdout);
}
static void output_genome(Genome *g, int archived) {
  printf("{\"type\":\"genome\",\"archived\":%s,\"id\":%d,\"parent\":%d,\"founder\":%d,\"living\":%"
         "d,\"offspring\":%d,\"depth\":%d,\"bornTick\":%d,\"harvested\":%.6f,\"stolen\":%.6f,"
         "\"donated\":%.6f,\"code\":[",
         archived ? "true" : "false", g->serial, g->parent_serial, g->founder, g->refs,
         g->offspring, g->depth, g->born_tick, g->harvested, g->stolen, g->donated);
  for (int k = 0; k < g->len; k++)
    printf("%s[%d,%.9g,%.9g,%.9g]", k ? "," : "", g->code[k].op, g->code[k].a, g->code[k].b,
           g->code[k].c);
  printf("],\"visits\":[");
  for (int k = 0; k < g->len; k++)
    printf("%s%llu", k ? "," : "", (unsigned long long)g->executed[k]);
  puts("]}");
}
int main(int argc, char **argv) {
  if (argc != 9) {
    fprintf(stderr, "Usage: headless SEED SECONDS SAMPLE FLOOR RATE SHARE FOOD SELECTION\n");
    return 2;
  }
  int seed = atoi(argv[1]), seconds = atoi(argv[2]), interval = atoi(argv[3]);
  if (seconds < 1 || interval < 1)
    return 2;
  research_selection = atoi(argv[8]);
  reset(seed);
  configure(24, 8192, 0, atof(argv[7]));
  configure_arrivals(atoi(argv[4]), atof(argv[6]), .8, atoi(argv[5]));
  seed_random(512);
  clock_t start = clock();
  sample();
  for (int second = 1; second <= seconds; second++) {
    step(60);
    if (second % interval == 0 || second == seconds)
      sample();
  }
  for (int g = 0; g < GENOMES; g++)
    if (genomes[g].refs)
      output_genome(&genomes[g], 0);
  for (int g = 0; g < archive_n; g++)
    output_genome(&archive[g], 1);
  printf("{\"type\":\"timing\",\"cpuSeconds\":%.6f,\"simulatedSeconds\":%d}\n",
         (double)(clock() - start) / CLOCKS_PER_SEC, seconds);
  return 0;
}
