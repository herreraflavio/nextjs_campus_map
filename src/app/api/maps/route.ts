// // app/api/maps/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { createMap, getMapById, getMapsByOwnerId } from "@/lib/mapModel";
// // import { addMapToUser } from "@/lib/userModel";
// import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

// const sampleMap = [
//   {
//     title: "campusmap",
//     description: null,
//     polygons: [
//       {
//         attributes: {
//           id: "polygon1",
//           name: "Future Field Education & Research Center",
//           description: "Drawn at 12:53:59 AM",
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13405639.913994065, 4489868.979555556],
//               [-13405602.2926442, 4489900.0320983],
//               [-13405590.37110494, 4489885.465486188],
//               [-13405540.641163161, 4489926.512370668],
//               [-13405532.428482719, 4489916.477518442],
//               [-13405506.678220551, 4489937.731676372],
//               [-13405516.340270976, 4489949.537474601],
//               [-13405482.565018037, 4489977.415426111],
//               [-13405383.9853717, 4489856.963621055],
//               [-13405315.850762526, 4489913.20164048],
//               [-13405253.047485115, 4489836.4640135085],
//               [-13405294.155873988, 4489662.659295601],
//               [-13405316.250952477, 4489623.395743958],
//               [-13405330.732186353, 4489608.615927947],
//               [-13405352.8466473, 4489595.234275751],
//               [-13405385.671300417, 4489587.267304821],
//               [-13405409.297208875, 4489587.1950323535],
//               [-13405639.913994065, 4489868.979555556],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [154, 254, 247, 0.37],
//           outline: { color: [50, 50, 50, 1], width: 2 },
//         },
//       },
//       {
//         attributes: {
//           id: "polygon2",
//           name: "COB III",
//           description: `<div>
//   <img
//     src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/cob3_front_view_wood_feature.jpg"
//     style="width: 350px"
//   /><img />
//   <h2>Classroom &amp; Office Building 3</h2>
//   <p>
//     <strong>Planning, Design, &amp; Construction Management</strong>
//   </p>
//   <h3>Details</h3>
//   <ul>
//     <li><strong>Budget:</strong> $75 Million</li>
//     <li><strong>GSF:</strong> 60,000</li>
//     <li><strong>Method:</strong> Design–build</li>
//     <li><strong>Complete:</strong> Dec 2027</li>
//   </ul>
//   <h3>Sources</h3>
//   <ul>
//     <li>
//       <a
//         href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucmercedcobiii_addendum_final_20250227.pdf"
//         >planning.ucmerced.edu</a
//       >
//     </li>
//     <li>
//       <a href="https://regents.universityofcalifornia.edu/regmeet/mar24/f4.pdf"
//         >regents.universityofcalifornia.edu</a
//       >
//     </li>
//   </ul>
// </div>`,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13405520.133740813, 4490419.182040105],
//               [-13405548.466333076, 4490450.47512113],
//               [-13405489.698891882, 4490493.192087619],
//               [-13405467.414654985, 4490467.320985527],
//               [-13405520.133740813, 4490419.182040105],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [103, 245, 35, 0.69],
//           outline: { color: [50, 50, 50, 1], width: 2 },
//         },
//       },
//       {
//         attributes: {
//           id: "polygon3",
//           name: "Field Education & Research Center",
//           description: `<div>
//   <img
//     src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/field_research_center.jpg"
//     style="width: 350px"
//   /><img />
//   <h2>Field Education &amp; Research Center</h2>
//   <h3>Details</h3>
//   <ul>
//     <li><strong>Budget:</strong> $4.8 Million</li>
//     <li><strong>GSF:</strong> 3,364</li>
//     <li><strong>Method:</strong> Design–bid–build</li>
//     <li><strong>Anticipated:</strong> Fall 2025</li>
//   </ul>
//   <h3>Sources</h3>
//   <ul>
//     <li>
//       <a
//         href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/uc_merced_field_education_center_eir_addendum_01312023.pdf"
//         target="_blank"
//         >planning.ucmerced.edu</a
//       >
//     </li>
//   </ul>
// </div>`,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13404518.738051932, 4491495.916322869],
//               [-13404273.386716483, 4491722.170861349],
//               [-13404148.449167322, 4491585.533967434],
//               [-13404394.752222978, 4491360.3202697085],
//               [-13404518.738051932, 4491495.916322869],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [224, 170, 70, 0.69],
//           outline: { color: [50, 50, 50, 1], width: 2 },
//         },
//       },
//       {
//         attributes: {
//           id: "polygon4",
//           name: "Promise Housing Parking Impact",
//           description: "Drawn at 12:44:38 AM",
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13405960.945696307, 4489562.783568999],
//               [-13405663.085106324, 4489561.752947709],
//               [-13405664.875766717, 4489376.051395507],
//               [-13405962.718612123, 4489377.081955401],
//               [-13405960.945696307, 4489562.783568999],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [254, 72, 72, 0.2],
//           outline: { color: [50, 50, 50, 1], width: 2 },
//         },
//       },
//       {
//         attributes: {
//           id: "polygon5",
//           name: "Promise Housing",
//           description: `<div>
//   <img
//     src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/promise_housing_update.jpg"
//     style="width: 350px"
//   /><img />
//   <h2>Promise Housing</h2>
//   <h3>Details</h3>
//   <ul>
//     <li><strong>Budget:</strong> $100 Million</li>
//     <li><strong>GSF:</strong> 125,000</li>
//     <li><strong>Beds:</strong> 488</li>
//     <li><strong>Method:</strong> Design–build</li>
//     <li><strong>Complete:</strong> Aug 2026</li>
//   </ul>
//   <h3>Sources</h3>
//   <ul>
//     <li>
//       <a
//         href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucm-mcc_housing_initial_study_dec2022_web_0.pdf"
//         >planning.ucmerced.edu</a
//       >
//     </li>
//     <li>
//       <a href="https://regents.universityofcalifornia.edu/regmeet/jan25/f3.pdf"
//         >regents.universityofcalifornia.edu</a
//       >
//     </li>
//     <li>
//       <a
//         href="https://taps.ucmerced.edu/news/2025/promise-housing-parking-impact"
//         >taps.ucmerced.edu</a
//       >
//     </li>
//   </ul>
// </div>`,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13405792.52679134, 4489553.228940487],
//               [-13405727.13730232, 4489553.228940487],
//               [-13405727.137235269, 4489531.5817333665],
//               [-13405732.661071943, 4489531.5817333665],
//               [-13405732.661080865, 4489497.468328693],
//               [-13405727.136992458, 4489497.468328693],
//               [-13405727.137088208, 4489484.102506439],
//               [-13405824.027143339, 4489484.102767631],
//               [-13405824.027184738, 4489497.468328693],
//               [-13405829.177771252, 4489497.468328693],
//               [-13405829.177896453, 4489537.889099569],
//               [-13405812.942418406, 4489537.889137694],
//               [-13405812.942324566, 4489507.592489875],
//               [-13405754.364265416, 4489507.592489873],
//               [-13405754.364339722, 4489531.5817333665],
//               [-13405792.526858391, 4489531.581851573],
//               [-13405792.52679134, 4489553.228940487],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [248, 48, 48, 0.69],
//           outline: { color: [50, 50, 50, 1], width: 2 },
//         },
//       },
//       {
//         attributes: {
//           id: "polygon6",
//           name: "Medical Education Building",
//           description: `<div>
//   <img
//     src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/screenshot_2025-01-30_161138.jpg"
//     style="width: 350px"
//   /><img />
//   <h2>Medical Education Building</h2>
//   <h3>Details</h3>
//   <ul>
//     <li><strong>Budget:</strong> $300 Million</li>
//     <li><strong>GSF:</strong> 203,500</li>
//     <li><strong>Method:</strong> CM at Risk</li>
//     <li><strong>CM:</strong> Turner Construction</li>
//     <li><strong>Complete:</strong> Fall 2026</li>
//   </ul>
//   <h3>Sources</h3>
//   <ul>
//     <li><a href="https://dc.ucmerced.edu/medical-education-building/sitelocation">dc.ucmerced.edu</a></li>
//     <li><a href="https://www.zgf.com/work/7973-university-of-california-merced-medical-education-building">zgf.com</a></li>
//     <li><a href="https://meb.ucmerced.edu/">meb.ucmerced.edu</a></li>
//   </ul>
// </div>`,
//         },
//         geometry: {
//           type: "polygon",
//           rings: [
//             [
//               [-13405402.563933335, 4489842.400391419],
//               [-13405442.914816955, 4489810.062580068],
//               [-13405455.271578984, 4489825.468597976],
//               [-13405433.086843148, 4489843.247782421],
//               [-13405466.154635066, 4489884.48191656],
//               [-13405478.113370895, 4489874.809732414],
//               [-13405487.574498653, 4489886.607402804],
//               [-13405497.72477589, 4489878.397893705],
//               [-13405518.011192584, 4489903.690352856],
//               [-13405477.800622903, 4489936.213634409],
//               [-13405402.563933335, 4489842.400391419],
//             ],
//             [
//               [-13405455.3441531, 4489801.258585031],
//               [-13405458.002260298, 4489799.493655381],
//               [-13405439.339932866, 4489776.222440979],
//               [-13405441.870603155, 4489774.1756504],
//               [-13405438.078417236, 4489769.486957606],
//               [-13405458.626432948, 4489752.867880857],
//               [-13405480.874169733, 4489780.609964721],
//               [-13405473.193550799, 4489786.822032124],
//               [-13405537.22112037, 4489866.661982666],
//               [-13405519.37171205, 4489881.098522338],
//               [-13405455.3441531, 4489801.258585031],
//             ],
//           ],
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//         symbol: {
//           type: "simple-fill",
//           color: [77, 251, 254, 0.69],
//           outline: { color: [50, 0, 100, 1], width: 2 },
//         },
//       },
//     ],
//     createdAt: new Date(1751785370722),
//     updatedAt: new Date(1752978015608),
//     isPrivate: false,
//     labels: [
//       {
//         attributes: {
//           parentId: "polygon1",
//           showAtZoom: 17,
//           hideAtZoom: null,
//           fontSize: 12,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "Future Field Education & Research Center",
//         },
//         geometry: {
//           type: "point",
//           x: -13405423.67705716,
//           y: 4489782.824997961,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//       {
//         attributes: {
//           parentId: "polygon2",
//           showAtZoom: 15,
//           hideAtZoom: null,
//           fontSize: 18,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "COB III",
//         },
//         geometry: {
//           type: "point",
//           x: -13405507.195807463,
//           y: 4490456.697632204,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//       {
//         attributes: {
//           parentId: "polygon3",
//           showAtZoom: 15,
//           hideAtZoom: null,
//           fontSize: 18,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "Field Education & Research Center",
//         },
//         geometry: {
//           type: "point",
//           x: -13404333.79598221,
//           y: 4491541.169796261,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//       {
//         attributes: {
//           parentId: "polygon4",
//           showAtZoom: 17,
//           hideAtZoom: null,
//           fontSize: 12,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "Promise Housing Parking Impact",
//         },
//         geometry: {
//           type: "point",
//           x: -13405812.95842323,
//           y: 4489469.435840005,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//       {
//         attributes: {
//           parentId: "polygon5",
//           showAtZoom: 15,
//           hideAtZoom: null,
//           fontSize: 18,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "Promise Housing",
//         },
//         geometry: {
//           type: "point",
//           x: -13405778.492231557,
//           y: 4489517.094787092,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//       {
//         attributes: {
//           parentId: "polygon6",
//           showAtZoom: 15,
//           hideAtZoom: 18,
//           fontSize: 18,
//           color: [0, 0, 0, 255],
//           haloColor: [255, 255, 255, 255],
//           haloSize: 1.5,
//           text: "Medical Education Building",
//         },
//         geometry: {
//           type: "point",
//           x: -13405455.251747217,
//           y: 4489877.72668279,
//           spatialReference: { wkid: 102100, latestWkid: 3857 },
//         },
//       },
//     ],

//     settings: {
//       zoom: 18,
//       center: [-13406195.137566043, 4490010.326915262] as [number, number],
//       constraints: {
//         xmin: -13408189.666272912,
//         ymin: 4488958.123447746,
//         xmax: -13404200.608859174,
//         ymax: 4491062.5303827785,
//       },
//       featureLayers: [
//         {
//           url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
//           index: 5,
//           outFields: ["*"],
//           popupEnabled: true,
//           popupTemplate: {
//             title: "{ZONENAME}",
//             content: [
//               {
//                 type: "fields",
//                 fieldInfos: [
//                   {
//                     fieldName: "hall",
//                     label: "Hall Name",
//                     visible: true,
//                   },
//                   {
//                     fieldName: "beds",
//                     label: "Number of Beds",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 0,
//                     },
//                   },
//                 ],
//               },
//             ],
//           },
//         },
//         {
//           url: "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/housing_hall_for_arcgis_XYTableToPoint/FeatureServer",
//           index: 45,
//           outFields: ["*"],
//           popupEnabled: true,
//           popupTemplate: {
//             title: "{hall}",
//             content: [
//               {
//                 type: "fields",
//                 fieldInfos: [
//                   {
//                     fieldName: "hall",
//                     label: "Hall Name",
//                     visible: true,
//                   },
//                   {
//                     fieldName: "beds",
//                     label: "Number of Beds",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 0,
//                     },
//                   },
//                   {
//                     fieldName: "incidents",
//                     label: "Total Incidents",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 0,
//                     },
//                   },
//                   {
//                     fieldName: "seriousness_sum",
//                     label: "Seriousness Sum",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 1,
//                     },
//                   },
//                   {
//                     fieldName: "exposure_bedyears",
//                     label: "Exposure (Bed-Years)",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 1,
//                     },
//                   },
//                   {
//                     fieldName: "rate_per_1k_bedyears",
//                     label: "Rate per 1,000 Bed-Years",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 2,
//                     },
//                   },
//                   {
//                     fieldName: "eb_rate_per_1k_bedyears",
//                     label: "EB Rate per 1,000 Bed-Years",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 2,
//                     },
//                   },
//                   {
//                     fieldName: "cri",
//                     label: "CRI",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 3,
//                     },
//                   },
//                   {
//                     fieldName: "cri_w",
//                     label: "CRI (Weighted)",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 3,
//                     },
//                   },
//                   {
//                     fieldName: "idx_0_100",
//                     label: "Index (0-100)",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 1,
//                     },
//                   },
//                   {
//                     fieldName: "idx_w_0_100",
//                     label: "Index Weighted (0-100)",
//                     visible: true,
//                     format: {
//                       digitSeparator: true,
//                       places: 1,
//                     },
//                   },
//                   {
//                     fieldName: "lon",
//                     label: "Longitude",
//                     visible: true,
//                     format: {
//                       places: 6,
//                     },
//                   },
//                   {
//                     fieldName: "lat",
//                     label: "Latitude",
//                     visible: true,
//                     format: {
//                       places: 6,
//                     },
//                   },
//                 ],
//               },
//             ],
//           },
//         },
//       ],
//     },
//   },
// ];

// export async function POST(request: NextRequest) {
//   // 1) ensure they're logged in
//   const session = await auth();
//   if (!session?.user?.email) {
//     return new Response(JSON.stringify({ error: "Unauthorized" }), {
//       status: 401,
//       headers: { "Content-Type": "application/json" },
//     });
//   }

//   // 2) pull name from the POST body
//   const { name } = (await request.json()) as { name?: string };
//   const title = name?.trim() || "";
//   const mapURL = `/maps/${title}`;

//   // 3) look up the user by email
//   const user = await findUserByEmail(session.user.email);
//   if (!user) {
//     return new Response(JSON.stringify({ error: "User not found" }), {
//       status: 404,
//       headers: { "Content-Type": "application/json" },
//     });
//   }

//   if (!user._id) {
//     return new Response(JSON.stringify({ error: "User id not found" }), {
//       status: 404,
//       headers: { "Content-Type": "application/json" },
//     });
//   }

//   // 4) create the map using the user's _id
//   const newMap = await createMap({
//     ownerId: user._id.toString(),
//     polygons: sampleMap[0].polygons, // empty for now
//     labels: sampleMap[0].labels,
//     featureLayers: sampleMap[0].settings.featureLayers,
//     settings: sampleMap[0].settings,
//     title,
//     url: undefined,
//     description: undefined,
//     isPrivate: false,
//   });

//   // 5) push mapId into their `maps` array
//   try {
//     await addMapToUserByEmail(user.email, newMap._id.toString());
//   } catch (err: any) {
//     return new Response(JSON.stringify({ error: err.message }), {
//       status: 500,
//       headers: { "Content-Type": "application/json" },
//     });
//   }

//   // 6) return the new mapId + title back to the client
//   return new Response(JSON.stringify(newMap), {
//     status: 200,
//     headers: { "Content-Type": "application/json" },
//   });
// }

// // GET: Fetch all maps for the logged-in user
// export async function GET(request: NextRequest) {
//   const session = await auth();
//   if (!session?.user?.email) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const user = await findUserByEmail(session.user.email);
//   if (!user || !user._id) {
//     return NextResponse.json({ error: "User not found" }, { status: 404 });
//   }

//   try {
//     const maps = await getMapsByOwnerId(user._id.toString());
//     return NextResponse.json(maps);
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }

// app/api/maps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createMap, getMapById, getMapsByOwnerId } from "@/lib/mapModel";
import { findUserByEmail, addMapToUserByEmail } from "@/lib/userModel";

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
              [-13405639.913994065, 4489868.979555556],
              [-13405602.2926442, 4489900.0320983],
              [-13405590.37110494, 4489885.465486188],
              [-13405540.641163161, 4489926.512370668],
              [-13405532.428482719, 4489916.477518442],
              [-13405506.678220551, 4489937.731676372],
              [-13405516.340270976, 4489949.537474601],
              [-13405482.565018037, 4489977.415426111],
              [-13405383.9853717, 4489856.963621055],
              [-13405315.850762526, 4489913.20164048],
              [-13405253.047485115, 4489836.4640135085],
              [-13405294.155873988, 4489662.659295601],
              [-13405316.250952477, 4489623.395743958],
              [-13405330.732186353, 4489608.615927947],
              [-13405352.8466473, 4489595.234275751],
              [-13405385.671300417, 4489587.267304821],
              [-13405409.297208875, 4489587.1950323535],
              [-13405639.913994065, 4489868.979555556],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [154, 254, 247, 0.37],
          outline: { color: [50, 50, 50, 1], width: 2 },
        },
      },
      {
        attributes: {
          id: "polygon2",
          name: "COB III",
          description: `<div>
  <img
    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/cob3_front_view_wood_feature.jpg"
    style="width: 350px"
  /><img />
  <h2>Classroom &amp; Office Building 3</h2>
  <p>
    <strong>Planning, Design, &amp; Construction Management</strong>
  </p>
  <h3>Details</h3>
  <ul>
    <li><strong>Budget:</strong> $75 Million</li>
    <li><strong>GSF:</strong> 60,000</li>
    <li><strong>Method:</strong> Design–build</li>
    <li><strong>Complete:</strong> Dec 2027</li>
  </ul>
  <h3>Sources</h3>
  <ul>
    <li>
      <a
        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucmercedcobiii_addendum_final_20250227.pdf"
        >planning.ucmerced.edu</a
      >
    </li>
    <li>
      <a href="https://regents.universityofcalifornia.edu/regmeet/mar24/f4.pdf"
        >regents.universityofcalifornia.edu</a
      >
    </li>
  </ul>
</div>`,
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13405520.133740813, 4490419.182040105],
              [-13405548.466333076, 4490450.47512113],
              [-13405489.698891882, 4490493.192087619],
              [-13405467.414654985, 4490467.320985527],
              [-13405520.133740813, 4490419.182040105],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [103, 245, 35, 0.69],
          outline: { color: [50, 50, 50, 1], width: 2 },
        },
      },
      {
        attributes: {
          id: "polygon3",
          name: "Field Education & Research Center",
          description: `<div>
  <img
    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/field_research_center.jpg"
    style="width: 350px"
  /><img />
  <h2>Field Education &amp; Research Center</h2>
  <h3>Details</h3>
  <ul>
    <li><strong>Budget:</strong> $4.8 Million</li>
    <li><strong>GSF:</strong> 3,364</li>
    <li><strong>Method:</strong> Design–bid–build</li>
    <li><strong>Anticipated:</strong> Fall 2025</li>
  </ul>
  <h3>Sources</h3>
  <ul>
    <li>
      <a
        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/uc_merced_field_education_center_eir_addendum_01312023.pdf"
        target="_blank"
        >planning.ucmerced.edu</a
      >
    </li>
  </ul>
</div>`,
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13404518.738051932, 4491495.916322869],
              [-13404273.386716483, 4491722.170861349],
              [-13404148.449167322, 4491585.533967434],
              [-13404394.752222978, 4491360.3202697085],
              [-13404518.738051932, 4491495.916322869],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [224, 170, 70, 0.69],
          outline: { color: [50, 50, 50, 1], width: 2 },
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
              [-13405960.945696307, 4489562.783568999],
              [-13405663.085106324, 4489561.752947709],
              [-13405664.875766717, 4489376.051395507],
              [-13405962.718612123, 4489377.081955401],
              [-13405960.945696307, 4489562.783568999],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [254, 72, 72, 0.2],
          outline: { color: [50, 50, 50, 1], width: 2 },
        },
      },
      {
        attributes: {
          id: "polygon5",
          name: "Promise Housing",
          description: `<div>
  <img
    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/promise_housing_update.jpg"
    style="width: 350px"
  /><img />
  <h2>Promise Housing</h2>
  <h3>Details</h3>
  <ul>
    <li><strong>Budget:</strong> $100 Million</li>
    <li><strong>GSF:</strong> 125,000</li>
    <li><strong>Beds:</strong> 488</li>
    <li><strong>Method:</strong> Design–build</li>
    <li><strong>Complete:</strong> Aug 2026</li>
  </ul>
  <h3>Sources</h3>
  <ul>
    <li>
      <a
        href="https://planning.ucmerced.edu/sites/g/files/ufvvjh1431/f/page/documents/ucm-mcc_housing_initial_study_dec2022_web_0.pdf"
        >planning.ucmerced.edu</a
      >
    </li>
    <li>
      <a href="https://regents.universityofcalifornia.edu/regmeet/jan25/f3.pdf"
        >regents.universityofcalifornia.edu</a
      >
    </li>
    <li>
      <a
        href="https://taps.ucmerced.edu/news/2025/promise-housing-parking-impact"
        >taps.ucmerced.edu</a
      >
    </li>
  </ul>
</div>`,
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13405792.52679134, 4489553.228940487],
              [-13405727.13730232, 4489553.228940487],
              [-13405727.137235269, 4489531.5817333665],
              [-13405732.661071943, 4489531.5817333665],
              [-13405732.661080865, 4489497.468328693],
              [-13405727.136992458, 4489497.468328693],
              [-13405727.137088208, 4489484.102506439],
              [-13405824.027143339, 4489484.102767631],
              [-13405824.027184738, 4489497.468328693],
              [-13405829.177771252, 4489497.468328693],
              [-13405829.177896453, 4489537.889099569],
              [-13405812.942418406, 4489537.889137694],
              [-13405812.942324566, 4489507.592489875],
              [-13405754.364265416, 4489507.592489873],
              [-13405754.364339722, 4489531.5817333665],
              [-13405792.526858391, 4489531.581851573],
              [-13405792.52679134, 4489553.228940487],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [248, 48, 48, 0.69],
          outline: { color: [50, 50, 50, 1], width: 2 },
        },
      },
      {
        attributes: {
          id: "polygon6",
          name: "Medical Education Building",
          description: `<div>
  <img
    src="https://dc.ucmerced.edu/sites/dc.ucmerced.edu/files/page/images/screenshot_2025-01-30_161138.jpg"
    style="width: 350px"
  /><img />
  <h2>Medical Education Building</h2>
  <h3>Details</h3>
  <ul>
    <li><strong>Budget:</strong> $300 Million</li>
    <li><strong>GSF:</strong> 203,500</li>
    <li><strong>Method:</strong> CM at Risk</li>
    <li><strong>CM:</strong> Turner Construction</li>
    <li><strong>Complete:</strong> Fall 2026</li>
  </ul>
  <h3>Sources</h3>
  <ul>
    <li><a href="https://dc.ucmerced.edu/medical-education-building/sitelocation">dc.ucmerced.edu</a></li>
    <li><a href="https://www.zgf.com/work/7973-university-of-california-merced-medical-education-building">zgf.com</a></li>
    <li><a href="https://meb.ucmerced.edu/">meb.ucmerced.edu</a></li>
  </ul>
</div>`,
        },
        geometry: {
          type: "polygon",
          rings: [
            [
              [-13405402.563933335, 4489842.400391419],
              [-13405442.914816955, 4489810.062580068],
              [-13405455.271578984, 4489825.468597976],
              [-13405433.086843148, 4489843.247782421],
              [-13405466.154635066, 4489884.48191656],
              [-13405478.113370895, 4489874.809732414],
              [-13405487.574498653, 4489886.607402804],
              [-13405497.72477589, 4489878.397893705],
              [-13405518.011192584, 4489903.690352856],
              [-13405477.800622903, 4489936.213634409],
              [-13405402.563933335, 4489842.400391419],
            ],
            [
              [-13405455.3441531, 4489801.258585031],
              [-13405458.002260298, 4489799.493655381],
              [-13405439.339932866, 4489776.222440979],
              [-13405441.870603155, 4489774.1756504],
              [-13405438.078417236, 4489769.486957606],
              [-13405458.626432948, 4489752.867880857],
              [-13405480.874169733, 4489780.609964721],
              [-13405473.193550799, 4489786.822032124],
              [-13405537.22112037, 4489866.661982666],
              [-13405519.37171205, 4489881.098522338],
              [-13405455.3441531, 4489801.258585031],
            ],
          ],
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
        symbol: {
          type: "simple-fill",
          color: [77, 251, 254, 0.69],
          outline: { color: [50, 0, 100, 1], width: 2 },
        },
      },
    ],
    createdAt: new Date(1751785370722),
    updatedAt: new Date(1752978015608),
    isPrivate: false,
    labels: [
      {
        attributes: {
          parentId: "polygon1",
          showAtZoom: 17,
          hideAtZoom: null,
          fontSize: 12,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "Future Field Education & Research Center",
        },
        geometry: {
          type: "point",
          x: -13405423.67705716,
          y: 4489782.824997961,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
      {
        attributes: {
          parentId: "polygon2",
          showAtZoom: 15,
          hideAtZoom: null,
          fontSize: 18,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "COB III",
        },
        geometry: {
          type: "point",
          x: -13405507.195807463,
          y: 4490456.697632204,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
      {
        attributes: {
          parentId: "polygon3",
          showAtZoom: 15,
          hideAtZoom: null,
          fontSize: 18,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "Field Education & Research Center",
        },
        geometry: {
          type: "point",
          x: -13404333.79598221,
          y: 4491541.169796261,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
      {
        attributes: {
          parentId: "polygon4",
          showAtZoom: 17,
          hideAtZoom: null,
          fontSize: 12,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "Promise Housing Parking Impact",
        },
        geometry: {
          type: "point",
          x: -13405812.95842323,
          y: 4489469.435840005,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
      {
        attributes: {
          parentId: "polygon5",
          showAtZoom: 15,
          hideAtZoom: null,
          fontSize: 18,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "Promise Housing",
        },
        geometry: {
          type: "point",
          x: -13405778.492231557,
          y: 4489517.094787092,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
      {
        attributes: {
          parentId: "polygon6",
          showAtZoom: 15,
          hideAtZoom: 18,
          fontSize: 18,
          color: [0, 0, 0, 255],
          haloColor: [255, 255, 255, 255],
          haloSize: 1.5,
          text: "Medical Education Building",
        },
        geometry: {
          type: "point",
          x: -13405455.251747217,
          y: 4489877.72668279,
          spatialReference: { wkid: 102100, latestWkid: 3857 },
        },
      },
    ],
    // ⬇️ NEW: sample events (stored as {attributes, geometry})
    events: [
      {
        attributes: {
          id: "evt-1",
          event_name: "Club Fair",
          description: "Meet campus orgs",
          date: "2025-09-15",
          startAt: "12:00",
          endAt: "15:00",
          locationTag: "ballroom",
          names: ["ASUCM", "Clubs Council"],
          fromUser: true,
        },
        geometry: {
          type: "point",
          x: -120.425,
          y: 37.3656,
          spatialReference: { wkid: 4326, latestWkid: 4326 },
        },
      },
      {
        attributes: {
          id: "evt-2",
          event_name: "CSE 176 Review Session",
          description: "Midterm prep",
          date: "2025-09-20",
          startAt: "18:00",
          endAt: "20:00",
          locationTag: "cob1-105",
          names: ["TA: Jane Doe"],
          fromUser: true,
        },
        geometry: {
          type: "point",
          x: -120.4245,
          y: 37.3637,
          spatialReference: { wkid: 4326, latestWkid: 4326 },
        },
      },
    ],

    settings: {
      zoom: 18,
      center: [-13406195.137566043, 4490010.326915262] as [number, number],
      constraints: {
        xmin: -13408189.666272912,
        ymin: 4488958.123447746,
        xmax: -13404200.608859174,
        ymax: 4491062.5303827785,
      },
      featureLayers: [
        {
          url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
          index: 5,
          outFields: ["*"],
          popupEnabled: true,
          popupTemplate: {
            title: "{ZONENAME}",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "AREA_",
                    label: "Area",
                    visible: true,
                  },
                ],
              },
            ],
          },
        },
        {
          url: "https://services2.arcgis.com/wx8u046p68e0iGuj/arcgis/rest/services/housing_hall_for_arcgis_XYTableToPoint/FeatureServer",
          index: 45,
          outFields: ["*"],
          popupEnabled: true,
          popupTemplate: {
            title: "{hall}",
            content: [
              {
                type: "fields",
                fieldInfos: [
                  {
                    fieldName: "hall",
                    label: "Hall Name",
                    visible: true,
                  },
                  {
                    fieldName: "beds",
                    label: "Number of Beds",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 0,
                    },
                  },
                  {
                    fieldName: "incidents",
                    label: "Total Incidents",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 0,
                    },
                  },
                  {
                    fieldName: "seriousness_sum",
                    label: "Seriousness Sum",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 1,
                    },
                  },
                  {
                    fieldName: "exposure_bedyears",
                    label: "Exposure (Bed-Years)",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 1,
                    },
                  },
                  {
                    fieldName: "rate_per_1k_bedyears",
                    label: "Rate per 1,000 Bed-Years",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 2,
                    },
                  },
                  {
                    fieldName: "eb_rate_per_1k_bedyears",
                    label: "EB Rate per 1,000 Bed-Years",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 2,
                    },
                  },
                  {
                    fieldName: "cri",
                    label: "CRI",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 3,
                    },
                  },
                  {
                    fieldName: "cri_w",
                    label: "CRI (Weighted)",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 3,
                    },
                  },
                  {
                    fieldName: "idx_0_100",
                    label: "Index (0-100)",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 1,
                    },
                  },
                  {
                    fieldName: "idx_w_0_100",
                    label: "Index Weighted (0-100)",
                    visible: true,
                    format: {
                      digitSeparator: true,
                      places: 1,
                    },
                  },
                  {
                    fieldName: "lon",
                    label: "Longitude",
                    visible: true,
                    format: {
                      places: 6,
                    },
                  },
                  {
                    fieldName: "lat",
                    label: "Latitude",
                    visible: true,
                    format: {
                      places: 6,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { name } = (await request.json()) as { name?: string };
  const title = name?.trim() || "";
  const user = await findUserByEmail(session.user.email);
  if (!user || !user._id) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const newMap = await createMap({
    ownerId: user._id.toString(),
    polygons: sampleMap[0].polygons,
    labels: sampleMap[0].labels,
    events: sampleMap[0].events, // ⬅️ NEW
    featureLayers: sampleMap[0].settings.featureLayers,
    settings: sampleMap[0].settings,
    title,
    url: undefined,
    description: undefined,
    isPrivate: false,
  });

  try {
    await addMapToUserByEmail(user.email, newMap._id.toString());
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(newMap), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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
