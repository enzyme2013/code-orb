export function main(): void {
  process.stdout.write("code-orb CLI scaffold\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
