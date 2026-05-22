"use client";

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";

export const DEFAULT_MAP_CENTER = { lat: 18.4861, lng: -69.9312 };

function parseCoords(lat: string, lng: string): { lat: number; lng: number } {
  const la = parseFloat(lat.replace(",", "."));
  const lo = parseFloat(lng.replace(",", "."));
  if (Number.isNaN(la) || Number.isNaN(lo)) return DEFAULT_MAP_CENTER;
  return { lat: la, lng: lo };
}

function pinIcon() {
  return L.divIcon({
    className: "location-map-pin",
    html: `<div style="width:24px;height:24px;background:#171717;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,.4);transform:translate(-50%,-100%);margin-left:12px"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

type LocationMapPickerProps = {
  latitude: string;
  longitude: string;
  onPositionChange: (lat: string, lng: string) => void;
  className?: string;
};

export function LocationMapPicker({
  latitude,
  longitude,
  onPositionChange,
  className,
}: LocationMapPickerProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const cbRef = React.useRef(onPositionChange);
  cbRef.current = onPositionChange;

  React.useLayoutEffect(() => {
    if (!wrapRef.current || mapRef.current) return;

    const el = wrapRef.current;
    const start = parseCoords(latitude, longitude);
    const map = L.map(el, {
      scrollWheelZoom: true,
    }).setView([start.lat, start.lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([start.lat, start.lng], {
      icon: pinIcon(),
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    const emit = (latlng: L.LatLng) => {
      cbRef.current(latlng.lat.toFixed(6), latlng.lng.toFixed(6));
    };

    marker.on("dragend", () => {
      emit(marker.getLatLng());
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      const ll = e.latlng;
      marker.setLatLng(ll);
      emit(ll);
    });

    mapRef.current = map;

    const fixSize = () => {
      map.invalidateSize({ animate: false });
    };
    requestAnimationFrame(fixSize);
    const t = window.setTimeout(fixSize, 300);

    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Montaje único; lat/lng iniciales vienen del primer render del padre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const la = parseFloat(latitude.replace(",", "."));
    const lo = parseFloat(longitude.replace(",", "."));
    if (Number.isNaN(la) || Number.isNaN(lo)) return;
    const m = markerRef.current;
    const cur = m.getLatLng();
    if (
      Math.abs(cur.lat - la) < 1e-7 &&
      Math.abs(cur.lng - lo) < 1e-7
    ) {
      return;
    }
    m.setLatLng([la, lo]);
    mapRef.current.panTo([la, lo]);
  }, [latitude, longitude]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "border-border bg-muted/30 z-0 min-h-[420px] w-full overflow-hidden rounded-xl border md:min-h-[460px]",
        className
      )}
      role="presentation"
    />
  );
}
