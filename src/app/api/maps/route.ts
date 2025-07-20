// app/api/maps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMap, getMapById, getMapsByOwnerId } from "@/lib/mapModel";
// import { addMapToUser } from "@/lib/userModel";
import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

// const sampleMap = [
//   {
//     polygons: [
//       {
//         attributes: {
//           id: "poly1",
//           name: "Engineering Quad",
//           description: "Building footprint for Engineering Quad",
//           showAtZoom: 14,
//           hideAtZoom: 18,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-120.423, 37.366],
//               [-120.422, 37.366],
//               [-120.422, 37.365],
//               [-120.423, 37.365],
//               [-120.423, 37.366],
//             ],
//           ],
//           spatialReference: { wkid: 4326 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [255, 0, 0, 0.4],
//           outline: {
//             color: [0, 0, 0, 1],
//             width: 1,
//           },
//         },
//       },
//       {
//         attributes: {
//           id: "poly2",
//           name: "Student Union Complex",
//           description: "Multipolygon: Student Union Building + Adjacent Plaza",
//           showAtZoom: 15,
//           hideAtZoom: 19,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-120.4215, 37.3665],
//               [-120.4205, 37.3665],
//               [-120.4205, 37.3655],
//               [-120.4215, 37.3655],
//               [-120.4215, 37.3665],
//             ],
//             [
//               [-120.4202, 37.3662],
//               [-120.4196, 37.3662],
//               [-120.4196, 37.3658],
//               [-120.4202, 37.3658],
//               [-120.4202, 37.3662],
//             ],
//           ],
//           spatialReference: { wkid: 4326 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [0, 128, 255, 0.4],
//           outline: {
//             color: [0, 0, 0, 1],
//             width: 1,
//           },
//         },
//       },
//     ],
//   },
// ];

const sampleMap = [
  {
    title: "campusmap",

    description: null,
    polygons: [
      {
        attributes: {
          id: "polygon1",
          name: "Future Field Education & Research Center",
          description: "Drawn at 12:53:59 AM",
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13405639.913994065" },
                { $numberDouble: "4489868.979555556" },
              ],
              [
                { $numberDouble: "-13405602.2926442" },
                { $numberDouble: "4489900.0320983" },
              ],
              [
                { $numberDouble: "-13405590.37110494" },
                { $numberDouble: "4489885.465486188" },
              ],
              [
                { $numberDouble: "-13405540.641163161" },
                { $numberDouble: "4489926.512370668" },
              ],
              [
                { $numberDouble: "-13405532.428482719" },
                { $numberDouble: "4489916.477518442" },
              ],
              [
                { $numberDouble: "-13405506.678220551" },
                { $numberDouble: "4489937.731676372" },
              ],
              [
                { $numberDouble: "-13405516.340270976" },
                { $numberDouble: "4489949.537474601" },
              ],
              [
                { $numberDouble: "-13405482.565018037" },
                { $numberDouble: "4489977.415426111" },
              ],
              [
                { $numberDouble: "-13405383.9853717" },
                { $numberDouble: "4489856.963621055" },
              ],
              [
                { $numberDouble: "-13405315.850762526" },
                { $numberDouble: "4489913.20164048" },
              ],
              [
                { $numberDouble: "-13405253.047485115" },
                { $numberDouble: "4489836.4640135085" },
              ],
              [
                { $numberDouble: "-13405294.155873988" },
                { $numberDouble: "4489662.659295601" },
              ],
              [
                { $numberDouble: "-13405316.250952477" },
                { $numberDouble: "4489623.395743958" },
              ],
              [
                { $numberDouble: "-13405330.732186353" },
                { $numberDouble: "4489608.615927947" },
              ],
              [
                { $numberDouble: "-13405352.8466473" },
                { $numberDouble: "4489595.234275751" },
              ],
              [
                { $numberDouble: "-13405385.671300417" },
                { $numberDouble: "4489587.267304821" },
              ],
              [
                { $numberDouble: "-13405409.297208875" },
                { $numberDouble: "4489587.1950323535" },
              ],
              [
                { $numberDouble: "-13405639.913994065" },
                { $numberDouble: "4489868.979555556" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "154" },
            { $numberInt: "254" },
            { $numberInt: "247" },
            { $numberDouble: "0.37" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
      {
        attributes: {
          id: "polygon2",
          name: "COB III",
          description:
            '<div>\n  <img\n    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/cob3_front_view_wood_feature.jpg"\n    style="width: 350px"\n  /><img />\n  <h2>Classroom &amp; Office Building 3</h2>\n  <p>\n    <strong>Planning, Design, &amp; Construction Management</strong>\n  </p>\n  <h3>Details</h3>\n  <ul>\n    <li><strong>Budget:</strong> $75 Million</li>\n    <li><strong>GSF:</strong> 60,000</li>\n    <li><strong>Method:</strong> Design–build</li>\n    <li><strong>Complete:</strong> Dec 2027</li>\n  </ul>\n  <h3>Sources</h3>\n  <ul>\n    <li>\n      <a\n        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucmercedcobiii_addendum_final_20250227.pdf"\n        >planning.ucmerced.edu</a\n      >\n    </li>\n    <li>\n      <a href="https://regents.universityofcalifornia.edu/regmeet/mar24/f4.pdf"\n        >regents.universityofcalifornia.edu</a\n      >\n    </li>\n  </ul>\n</div>\n',
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13405520.133740813" },
                { $numberDouble: "4490419.182040105" },
              ],
              [
                { $numberDouble: "-13405548.466333076" },
                { $numberDouble: "4490450.47512113" },
              ],
              [
                { $numberDouble: "-13405489.698891882" },
                { $numberDouble: "4490493.192087619" },
              ],
              [
                { $numberDouble: "-13405467.414654985" },
                { $numberDouble: "4490467.320985527" },
              ],
              [
                { $numberDouble: "-13405520.133740813" },
                { $numberDouble: "4490419.182040105" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "103" },
            { $numberInt: "245" },
            { $numberInt: "35" },
            { $numberDouble: "0.69" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
      {
        attributes: {
          id: "polygon3",
          name: "Field Education & Research Center",
          description:
            '<div>\n  <img\n    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/field_research_center.jpg"\n    style="width: 350px"\n  /><img />\n  <h2>Field Education &amp; Research Center</h2>\n  <h3>Details</h3>\n  <ul>\n    <li><strong>Budget:</strong> $4.8 Million</li>\n    <li><strong>GSF:</strong> 3,364</li>\n    <li><strong>Method:</strong> Design–bid–build</li>\n    <li><strong>Anticipated:</strong> Fall 2025</li>\n  </ul>\n  <h3>Sources</h3>\n  <ul>\n    <li>\n      <a\n        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/uc_merced_field_education_center_eir_addendum_01312023.pdf"\n        target="_blank"\n        >planning.ucmerced.edu</a\n      >\n    </li>\n  </ul>\n</div>\n',
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13404518.738051932" },
                { $numberDouble: "4491495.916322869" },
              ],
              [
                { $numberDouble: "-13404273.386716483" },
                { $numberDouble: "4491722.170861349" },
              ],
              [
                { $numberDouble: "-13404148.449167322" },
                { $numberDouble: "4491585.533967434" },
              ],
              [
                { $numberDouble: "-13404394.752222978" },
                { $numberDouble: "4491360.3202697085" },
              ],
              [
                { $numberDouble: "-13404518.738051932" },
                { $numberDouble: "4491495.916322869" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "224" },
            { $numberInt: "170" },
            { $numberInt: "70" },
            { $numberDouble: "0.69" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
      {
        attributes: {
          id: "polygon4",
          name: "Promise Housing Parking Impact",
          description: "Drawn at 12:44:38 AM",
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13405960.945696307" },
                { $numberDouble: "4489562.783568999" },
              ],
              [
                { $numberDouble: "-13405663.085106324" },
                { $numberDouble: "4489561.752947709" },
              ],
              [
                { $numberDouble: "-13405664.875766717" },
                { $numberDouble: "4489376.051395507" },
              ],
              [
                { $numberDouble: "-13405962.718612123" },
                { $numberDouble: "4489377.081955401" },
              ],
              [
                { $numberDouble: "-13405960.945696307" },
                { $numberDouble: "4489562.783568999" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "254" },
            { $numberInt: "72" },
            { $numberInt: "72" },
            { $numberDouble: "0.2" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
      {
        attributes: {
          id: "polygon5",
          name: "Promise Housing",
          description:
            '<div>\n  <img\n    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/promise_housing_update.jpg"\n    style="width: 350px"\n  /><img />\n  <h2>Promise Housing</h2>\n  <h3>Details</h3>\n  <ul>\n    <li><strong>Budget:</strong> $100 Million</li>\n    <li><strong>GSF:</strong> 125,000</li>\n    <li><strong>Beds:</strong> 488</li>\n    <li><strong>Method:</strong> Design–build</li>\n    <li><strong>Complete:</strong> Aug 2026</li>\n  </ul>\n  <h3>Sources</h3>\n  <ul>\n    <li>\n      <a\n        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucm-mcc_housing_initial_study_dec2022_web_0.pdf"\n        >planning.ucmerced.edu</a\n      >\n    </li>\n    <li>\n      <a href="https://regents.universityofcalifornia.edu/regmeet/jan25/f3.pdf"\n        >regents.universityofcalifornia.edu</a\n      >\n    </li>\n    <li>\n      <a\n        href="https://taps.ucmerced.edu/news/2025/promise-housing-parking-impact"\n        >taps.ucmerced.edu</a\n      >\n    </li>\n  </ul>\n</div>\n',
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13405792.52679134" },
                { $numberDouble: "4489553.228940487" },
              ],
              [
                { $numberDouble: "-13405727.13730232" },
                { $numberDouble: "4489553.228940487" },
              ],
              [
                { $numberDouble: "-13405727.137235269" },
                { $numberDouble: "4489531.5817333665" },
              ],
              [
                { $numberDouble: "-13405732.661071943" },
                { $numberDouble: "4489531.5817333665" },
              ],
              [
                { $numberDouble: "-13405732.661080865" },
                { $numberDouble: "4489497.468328693" },
              ],
              [
                { $numberDouble: "-13405727.136992458" },
                { $numberDouble: "4489497.468328693" },
              ],
              [
                { $numberDouble: "-13405727.137088208" },
                { $numberDouble: "4489484.102506439" },
              ],
              [
                { $numberDouble: "-13405824.027143339" },
                { $numberDouble: "4489484.102767631" },
              ],
              [
                { $numberDouble: "-13405824.027184738" },
                { $numberDouble: "4489497.468328693" },
              ],
              [
                { $numberDouble: "-13405829.177771252" },
                { $numberDouble: "4489497.468328693" },
              ],
              [
                { $numberDouble: "-13405829.177896453" },
                { $numberDouble: "4489537.889099569" },
              ],
              [
                { $numberDouble: "-13405812.942418406" },
                { $numberDouble: "4489537.889137694" },
              ],
              [
                { $numberDouble: "-13405812.942324566" },
                { $numberDouble: "4489507.592489875" },
              ],
              [
                { $numberDouble: "-13405754.364265416" },
                { $numberDouble: "4489507.592489873" },
              ],
              [
                { $numberDouble: "-13405754.364339722" },
                { $numberDouble: "4489531.5817333665" },
              ],
              [
                { $numberDouble: "-13405792.526858391" },
                { $numberDouble: "4489531.581851573" },
              ],
              [
                { $numberDouble: "-13405792.52679134" },
                { $numberDouble: "4489553.228940487" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "248" },
            { $numberInt: "48" },
            { $numberInt: "48" },
            { $numberDouble: "0.69" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "50" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
      {
        attributes: {
          id: "polygon6",
          name: "Medical Education Building",
          description:
            '<div>\n  <img\n    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/screenshot_2025-01-30_161138.jpg"\n    style="width: 350px"\n  /><img />\n  <h2>Medical Education Building</h2>\n  <h3>Details</h3>\n  <ul>\n    <li><strong>Budget:</strong> $300 Million</li>\n    <li><strong>GSF:</strong> 203,500</li>\n    <li><strong>Method:</strong> CM at Risk</li>\n    <li><strong>CM:</strong> Turner Construction</li>\n    <li><strong>Complete:</strong> Fall 2026</li>\n  </ul>\n  <h3>Sources</h3>\n  <ul>\n    <li>\n      <a href="https://dc.ucmerced.edu/medical-education-building/sitelocation"\n        >dc.ucmerced.edu</a\n      >\n    </li>\n    <li>\n      <a\n        href="https://www.zgf.com/work/7973-university-of-california-merced-medical-education-building"\n        >zgf.com</a\n      >\n    </li>\n    <li><a href="https://meb.ucmerced.edu/">meb.ucmerced.edu</a></li>\n  </ul>\n</div>\n',
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [
                { $numberDouble: "-13405402.563933335" },
                { $numberDouble: "4489842.400391419" },
              ],
              [
                { $numberDouble: "-13405442.914816955" },
                { $numberDouble: "4489810.062580068" },
              ],
              [
                { $numberDouble: "-13405455.271578984" },
                { $numberDouble: "4489825.468597976" },
              ],
              [
                { $numberDouble: "-13405433.086843148" },
                { $numberDouble: "4489843.247782421" },
              ],
              [
                { $numberDouble: "-13405466.154635066" },
                { $numberDouble: "4489884.48191656" },
              ],
              [
                { $numberDouble: "-13405478.113370895" },
                { $numberDouble: "4489874.809732414" },
              ],
              [
                { $numberDouble: "-13405487.574498653" },
                { $numberDouble: "4489886.607402804" },
              ],
              [
                { $numberDouble: "-13405497.72477589" },
                { $numberDouble: "4489878.397893705" },
              ],
              [
                { $numberDouble: "-13405518.011192584" },
                { $numberDouble: "4489903.690352856" },
              ],
              [
                { $numberDouble: "-13405477.800622903" },
                { $numberDouble: "4489936.213634409" },
              ],
              [
                { $numberDouble: "-13405402.563933335" },
                { $numberDouble: "4489842.400391419" },
              ],
            ],
            [
              [
                { $numberDouble: "-13405455.3441531" },
                { $numberDouble: "4489801.258585031" },
              ],
              [
                { $numberDouble: "-13405458.002260298" },
                { $numberDouble: "4489799.493655381" },
              ],
              [
                { $numberDouble: "-13405439.339932866" },
                { $numberDouble: "4489776.222440979" },
              ],
              [
                { $numberDouble: "-13405441.870603155" },
                { $numberDouble: "4489774.1756504" },
                { $numberInt: "0" },
              ],
              [
                { $numberDouble: "-13405438.078417236" },
                { $numberDouble: "4489769.486957606" },
              ],
              [
                { $numberDouble: "-13405458.626432948" },
                { $numberDouble: "4489752.867880857" },
              ],
              [
                { $numberDouble: "-13405480.874169733" },
                { $numberDouble: "4489780.609964721" },
              ],
              [
                { $numberDouble: "-13405473.193550799" },
                { $numberDouble: "4489786.822032124" },
              ],
              [
                { $numberDouble: "-13405537.22112037" },
                { $numberDouble: "4489866.661982666" },
              ],
              [
                { $numberDouble: "-13405519.37171205" },
                { $numberDouble: "4489881.098522338" },
              ],
              [
                { $numberDouble: "-13405455.3441531" },
                { $numberDouble: "4489801.258585031" },
              ],
            ],
          ],
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
        symbol: {
          type: "simple-fill",
          color: [
            { $numberInt: "77" },
            { $numberInt: "251" },
            { $numberInt: "254" },
            { $numberDouble: "0.69" },
          ],
          outline: {
            color: [
              { $numberInt: "50" },
              { $numberInt: "0" },
              { $numberInt: "100" },
              { $numberInt: "1" },
            ],
            width: { $numberInt: "2" },
          },
        },
      },
    ],
    createdAt: { $date: { $numberLong: "1751785370722" } },
    updatedAt: { $date: { $numberLong: "1752978015608" } },
    isPrivate: false,
    labels: [
      {
        attributes: {
          parentId: "polygon1",
          showAtZoom: { $numberInt: "17" },
          hideAtZoom: null,
          fontSize: { $numberInt: "12" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "Future Field Education & Research Center",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13405423.67705716" },
          y: { $numberDouble: "4489782.824997961" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
      {
        attributes: {
          parentId: "polygon2",
          showAtZoom: { $numberInt: "15" },
          hideAtZoom: null,
          fontSize: { $numberInt: "18" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "COB III",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13405507.195807463" },
          y: { $numberDouble: "4490456.697632204" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
      {
        attributes: {
          parentId: "polygon3",
          showAtZoom: { $numberInt: "15" },
          hideAtZoom: null,
          fontSize: { $numberInt: "18" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "Field Education & Research Center",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13404333.79598221" },
          y: { $numberDouble: "4491541.169796261" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
      {
        attributes: {
          parentId: "polygon4",
          showAtZoom: { $numberInt: "17" },
          hideAtZoom: null,
          fontSize: { $numberInt: "12" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "Promise Housing Parking Impact",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13405812.95842323" },
          y: { $numberDouble: "4489469.435840005" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
      {
        attributes: {
          parentId: "polygon5",
          showAtZoom: { $numberInt: "15" },
          hideAtZoom: null,
          fontSize: { $numberInt: "18" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "Promise Housing",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13405778.492231557" },
          y: { $numberDouble: "4489517.094787092" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
      {
        attributes: {
          parentId: "polygon6",
          showAtZoom: { $numberInt: "15" },
          hideAtZoom: { $numberInt: "18" },
          fontSize: { $numberInt: "18" },
          color: [
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "0" },
            { $numberInt: "255" },
          ],
          haloColor: [
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
            { $numberInt: "255" },
          ],
          haloSize: { $numberDouble: "1.5" },
          text: "Medical Education Building",
        },
        geometry: {
          type: "point",
          x: { $numberDouble: "-13405455.251747217" },
          y: { $numberDouble: "4489877.72668279" },
          spatialReference: {
            latestWkid: { $numberInt: "3857" },
            wkid: { $numberInt: "102100" },
          },
        },
      },
    ],
  },
];

export async function POST(request: NextRequest) {
  // 1) ensure they're logged in
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2) pull name from the POST body
  const { name } = (await request.json()) as { name?: string };
  const title = name?.trim() || "";
  const mapURL = `/maps/${title}`;

  // 3) look up the user by email
  const user = await findUserByEmail(session.user.email);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!user._id) {
    return new Response(JSON.stringify({ error: "User id not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4) create the map using the user's _id
  const newMap = await createMap({
    ownerId: user._id.toString(),
    polygons: sampleMap[0].polygons, // empty for now
    title,
    url: undefined,
    description: undefined,
    isPrivate: false,
  });

  // 5) push mapId into their `maps` array
  try {
    await addMapToUserByEmail(user.email, newMap._id.toString());
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6) return the new mapId + title back to the client
  return new Response(JSON.stringify(newMap), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// GET: Fetch all maps for the logged-in user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByEmail(session.user.email);
  if (!user || !user._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const maps = await getMapsByOwnerId(user._id.toString());
    return NextResponse.json(maps);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
