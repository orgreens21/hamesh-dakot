// One small line drawing per product category, on a 96×96 grid. Drawn here rather than using photos or
// packaging: the game shows what kind of thing it is, and the name says which one.
// Classes: .a is the accent-tinted detail, .p is paper-filled (hides lines behind it).
export const ART = {
  dairy: '<path class="a" d="M30 50h36v16H30z"/><path d="M30 34h36v48H30zM30 34l8-14h20l8 14M38 20v-7h20v7"/>',
  eggs: '<ellipse cx="30" cy="46" rx="9" ry="12"/><ellipse class="a" cx="48" cy="46" rx="9" ry="12"/><ellipse cx="48" cy="46" rx="9" ry="12"/><ellipse cx="66" cy="46" rx="9" ry="12"/><path class="p" d="M14 54h68l-6 26H20z"/><path d="M14 54h68l-6 26H20zM37 54v8M59 54v8"/>',
  bread: '<path class="a" d="M24 54h48v20H24z"/><path d="M18 44c0-12 10-18 30-18s30 6 30 18c0 5-3 8-6 9v21H24V53c-3-1-6-4-6-9zM38 36l-4 9M50 34l-4 11M62 36l-4 9"/>',
  snack: '<circle class="a" cx="48" cy="49" r="11"/><path d="M28 16h40c-2 6-2 10 0 14v38c-2 4-2 8 0 12H28c2-4 2-8 0-12V30c2-4 2-8 0-14zM30 23h36M30 73h36"/><circle cx="48" cy="49" r="11"/>',
  sweet: '<path class="a" d="M22 50h52v24H22z"/><path d="M22 22h52v52H22zM22 39h52M39 22v28M57 22v28M22 50l8 6 9-6 9 6 9-6 9 6 8-6"/>',
  drink: '<path class="a" d="M32 46h32v16H32z"/><path d="M40 10h16v10l8 14v44a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V34l8-14zM40 20h16M32 46h32M32 62h32"/>',
  alcohol: '<path class="a" d="M59 50h16c-.6 8-3.300 12-8 12s-7.400-4-8-12z"/><path d="M33 8h10v20c6 4 8 9 8 16v40H25V44c0-7 2-12 8-16zM58 42h18c0 13-3 20-9 20s-9-7-9-20zM67 62v20M60 84h14M25 54h26"/>',
  coffee: '<path class="a" d="M22 54h44v6a18 18 0 0 1-18 18h-8a18 18 0 0 1-18-18z"/><path d="M22 40h44v20a18 18 0 0 1-18 18h-8a18 18 0 0 1-18-18zM66 46h5a8 8 0 0 1 0 16h-5.500M36 30c-3-5 3-7 0-12M50 30c-3-5 3-7 0-12M14 86h62"/>',
  pantry: '<circle class="a" cx="48" cy="56" r="11"/><path d="M28 26h40l4 58H24zM28 26l5-10h30l5 10M38 16l3 10M58 16l-3 10"/><circle cx="48" cy="56" r="11"/>',
  can: '<path class="a" d="M26 42c0 4.400 9.800 8 22 8s22-3.600 22-8v22c0 4.400-9.800 8-22 8s-22-3.600-22-8z"/><ellipse cx="48" cy="26" rx="22" ry="8"/><path d="M26 26v46c0 4.400 9.800 8 22 8s22-3.600 22-8V26M26 42c0 4.400 9.800 8 22 8s22-3.600 22-8M26 64c0 4.400 9.800 8 22 8s22-3.600 22-8"/>',
  deli: '<path class="a" d="M20.400 54h55.200l-1.800 12H22.200z"/><path d="M18 38h60l-6 42H24zM13 28h70v10H13zM20.400 54h55.200M22.200 66h51.600"/>',
  meat: '<circle class="a" cx="56" cy="46" r="8"/><path d="M20 48c0-15 13-26 30-26s28 8 28 22c0 16-12 32-32 32-15 0-26-12-26-28z"/><circle cx="56" cy="46" r="8"/><path d="M30 50c1 9 7 15 15 16"/>',
  frozen: '<path class="a" d="M16 24h64v14H16z"/><path d="M16 24h64v56H16zM16 38h64M48 46v26M36.700 52.500l22.600 13M59.300 52.500l-22.600 13M44 48l4 4 4-4M44 70l4-4 4 4"/>',
  produce: '<path class="a" d="M55 22c6-7 13-5 16-3-4 7-11 8-16 3z"/><path d="M48 32c-8-6-25-4-25 16 0 16 10 31 19 31 3 0 4-2 6-2s3 2 6 2c9 0 19-15 19-31 0-20-17-22-25-16zM48 32c0-7 2-12 6-16M55 22c6-7 13-5 16-3-4 7-11 8-16 3z"/>',
  veg: '<path class="a" d="M40 52c5-7 10-12 16-16 6 0 12 6 12 12-4 6-9 11-16 16z"/><path d="M26 76c-3-3 14-30 30-40 6 0 12 6 12 12-10 16-39 31-42 28zM62 40c-1-9 2-16 8-20M64 42c9 1 16-2 20-8M59 37c-6-6-7-13-4-19M40 52l6 6M33 62l5 5M50 44l5 5"/>',
  clean: '<path class="a" d="M34 56h28v14H34z"/><path d="M34 46h28v34a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4zM42 46V34h12v12M38 34h26V20H48l-10 7zM48 34l-6 9M34 56h28M34 70h28M22 18l-6-3M22 25h-7M22 32l-6 3"/>',
  paper: '<path class="a" d="M42 60h22v22H42z"/><path d="M36 22h26c8 0 14 8.500 14 19s-6 19-14 19H36M64 60v22H42V60"/><ellipse class="p" cx="36" cy="41" rx="14" ry="19"/><ellipse cx="36" cy="41" rx="14" ry="19"/><ellipse cx="36" cy="41" rx="5" ry="7"/><path d="M42 68h22" stroke-dasharray="3 4"/>',
  care: '<path class="a" d="M31.500 44h33l1.500 14H30z"/><path d="M34 12h28l6 58H28zM36 70h24v14H36zM31.500 44h33M30 58h36"/>',
  pet: '<path class="a" d="M19 62h58l-2.500 8h-53z"/><path d="M16 52h64l-8 28H24zM19 62h58M36 30a5 5 0 1 1 6-7h12a5 5 0 1 1 6 7 5 5 0 1 1-6 7H42a5 5 0 1 1-6-7z"/>',
};
