// lib/mapModel.js
import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

/**
 * mapData: {
 *   ownerId: string,            // user._id as a string
 *   polygons: Array<{
 *     attributes: { id: string; name: string; description: string; showAtZoom?: number; hideAtZoom?: number },
 *     geometry: { type: "polygon"; rings: number[][][]; spatialReference: { wkid: number } },
 *     symbol: { type: "simple-fill"; color: number[]; outline: { color: number[]; width: number } }
 *   }>
 * }
 */

export type MapSettings = {
  zoom: number;
  center: [number, number]; // [x, y] in Web Mercator
  constraints?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
};

export async function createMap(mapData: {
  ownerId: string;
  polygons: any[];
  labels: any[];
  settings: MapSettings;
  title?: string;
  url?: string;
  description?: string;
  isPrivate: boolean;
}) {
  const db = (await clientPromise).db();
  const generatedId = new ObjectId();
  const mapURL = `/maps/${generatedId}`;
  const newMapDoc = {
    _id: generatedId,
    ownerId: new ObjectId(mapData.ownerId),
    title: mapData.title || null,
    url: mapURL || null,
    description: mapData.description || null,
    polygons: mapData.polygons,
    labels: mapData.labels,
    settings: mapData.settings,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPrivate: mapData.isPrivate,
  };
  const res = await db.collection("maps").insertOne(newMapDoc);
  console.log(newMapDoc);

  return newMapDoc;
}

export async function getMapById(mapId: string) {
  const db = (await clientPromise).db();
  return db.collection("maps").findOne({ _id: new ObjectId(mapId) });
}

export async function getMapsByUser(userId: string) {
  const db = (await clientPromise).db();
  return db
    .collection("maps")
    .find({ ownerId: new ObjectId(userId) })
    .toArray();
}

export async function getMapsByOwnerId(ownerId: string) {
  const client = await clientPromise;
  const db = client.db();
  const maps = await db
    .collection("maps")
    .find({ ownerId: new ObjectId(ownerId) })
    .toArray();

  return maps.map(({ _id, ...rest }) => ({
    _id: _id.toString(),
    ...rest,
  }));
}
