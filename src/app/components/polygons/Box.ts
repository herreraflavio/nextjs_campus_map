// export default function Box(): number[][] {
//   const rings = [
//     [-120.31, 37.31],
//     [-120.29, 37.31],
//     [-120.29, 37.29],
//     [-120.31, 37.29],
//     [-120.31, 37.31],
//   ];

//   return rings;
// }
export default function Box(): number[][] {
  const rings = [
    [-120.424817, 37.365371], // top-left
    [-120.423441, 37.365371], // top-right
    [-120.423441, 37.364547], // bottom-right
    [-120.424817, 37.364547], // bottom-left
    [-120.424817, 37.365371], // close ring
  ];

  return rings;
}
