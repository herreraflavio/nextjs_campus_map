"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMapId } from "@/app/context/MapContext";
import { useApiSources } from "../apiSourceStore";
import { goToEvent } from "../eventLocations";
import { useMapEvents } from "./useMapDrawings";
import {
  getEventOwnVisibility, setEventSourcesVisibility, setEventVisibility,
  setHomeVisibility, subscribeVisibility,
} from "../categories/categoryVisibility";
import MapSidebar, { type MapSidebarProps } from "./MapSidebar";
import CopyLocationLinkButton from "./CopyLocationLinkButton";
import styles from "./MapSidebar.module.css";
import MapLoadingSkeleton from "../MapLoadingSkeleton";

export default function MapSidebarTabs(props: MapSidebarProps) {
  const mapId = useMapId();
  const events = useMapEvents();
  const { sources, statuses, ready, configurationFailed } = useApiSources();
  const [active, setActive] = useState("home");
  const selectedLink = useRef<string | null>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [, update] = useState(0);
  const query = useSearchParams();
  const eventId = query.get("event");
  const sourceId = query.get("source");
  const tabs = new Map<string, { name: string; urls: string[] }>();
  sources.forEach(source => {
    const id = `source:${source.tabName.toLowerCase()}`;
    const tab = tabs.get(id) ?? { name: source.tabName, urls: [] };
    tab.urls.push(source.url);
    tabs.set(id, tab);
  });
  // Saved events can share a configured Events tab, but never create one.
  tabs.get("source:events")?.urls.push("");
  const tabSignature = JSON.stringify([...tabs]);
  useEffect(() => {
    tabListRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, tabSignature]);
  useEffect(() => subscribeVisibility(() => update(value => value + 1)), []);
  useEffect(() => {
    if (active !== "home" && !tabs.has(active)) setActive("home");
  }, [active, tabSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!eventId) { selectedLink.current = null; return; }
    const link = JSON.stringify([mapId, eventId, sourceId]);
    if (selectedLink.current === link) return;
    const selected = events.find(event => String(event.attributes?.id) === eventId &&
      (!sourceId || event.attributes?.sourceId === sourceId));
    if (!selected) return;
    const tab = [...tabs].find(([, tab]) => tab.urls.includes(selected.attributes?.sourceUrl || ""));
    if (tab) { setActive(tab[0]); selectedLink.current = link; }
  }, [mapId, eventId, sourceId, events, tabSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = tabs.get(active);
  const entries = events.filter(event => current?.urls.includes(event.attributes?.sourceUrl || ""))
    .sort((a, b) => String(a.attributes?.event_name).localeCompare(String(b.attributes?.event_name)));
  const loading = current?.urls.some(url => url && (!statuses.has(url) || statuses.get(url) === "loading"));
  const failed = current?.urls.some(url => statuses.get(url) === "error");
  const setAll = (visible: boolean) => {
    if (active === "home") setHomeVisibility(visible);
    else if (current) setEventSourcesVisibility(current.urls, visible);
  };
  if (!ready) return configurationFailed ? null : <MapLoadingSkeleton section="sidebar" />;
  return (
    <div className={styles.tabbedPanel}>
      <div ref={tabListRef} className={styles.tabs} role="tablist" aria-label="Map content">
        {[{ id: "home", name: "Home" }, ...[...tabs].map(([id, tab]) => ({ id, name: tab.name }))].map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id}
            title={tab.name} className={styles.tabButton} onClick={() => setActive(tab.id)}>
            <span className={styles.tabLabel}><span className={styles.tabText}>{tab.name}</span></span>
          </button>
        ))}
      </div>
      <div className={styles.tabContent} role="tabpanel" aria-label={active === "home" ? "Home" : current?.name}>
        <div className={styles.bulkActions}>
          <button type="button" className={styles.actionButton} onClick={() => setAll(false)}>Hide all</button>
          <button type="button" className={styles.actionButton} onClick={() => setAll(true)}>Show all</button>
        </div>
        <div hidden={active !== "home"}><MapSidebar {...props} /></div>
        {current && (
          <section aria-label={current.name}>
            {loading && <p role="status">Loading {current.name.toLowerCase()}…</p>}
            {failed && <p role="status">An API source could not be loaded.</p>}
            <div className={styles.list} role="list">
              {entries.map(event => {
                const attributes = event.attributes ?? {};
                const name = attributes.event_name || "Event";
                const visible = getEventOwnVisibility(event);
                return (
                  <div key={JSON.stringify([attributes.sourceUrl, attributes.id])} role="listitem"
                    className={[styles.item, visible ? "" : styles.muted].join(" ")}>
                    <div className={styles.itemTopLine}>
                      <button type="button" className={styles.eventLabel} onClick={() => { void goToEvent(event); }}>
                        <span>{name}</span>
                      </button>
                      <div className={styles.rowControls}>
                        <CopyLocationLinkButton name={name} eventId={String(attributes.id)} sourceId={attributes.sourceId} />
                        <button type="button" className={styles.visibilityButton} aria-pressed={visible}
                          aria-label={`${visible ? "Hide" : "Show"} ${name}`}
                          onClick={() => setEventVisibility(event, !visible)}>{visible ? "✓" : ""}</button>
                      </div>
                    </div>
                    <div className={styles.eventMeta}>{[attributes.location, attributes.location_at, attributes.date].filter(Boolean).join(" · ")}</div>
                  </div>
                );
              })}
              {!entries.length && !loading && <p className={styles.empty}>No {current.name.toLowerCase()} available.</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
