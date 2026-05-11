"use client";
import { useCallback, useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { ISourceOptions, MoveDirection, OutMode } from "@tsparticles/engine";

const OPTIONS: ISourceOptions = {
  fullScreen: { enable: false },
  fpsLimit: 60,
  particles: {
    number: { value: 120, density: { enable: true } },
    color: { value: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#059669", "#d1fae5"] },
    shape: { type: "circle" },
    opacity: {
      value: { min: 0.06, max: 0.45 },
      animation: { enable: true, speed: 0.5, sync: false },
    },
    size: {
      value: { min: 1, max: 4 },
      animation: { enable: true, speed: 1.2, sync: false },
    },
    links: {
      enable: true,
      distance: 140,
      color: "#10b981",
      opacity: 0.15,
      width: 1,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: "none" as MoveDirection,
      random: true,
      straight: false,
      outModes: { default: "out" as OutMode },
    },
  },
  interactivity: {
    events: {
      onHover: { enable: true, mode: ["grab", "bubble"] },
      resize: { enable: true },
    },
    modes: {
      grab: { distance: 160, links: { opacity: 0.35 } },
      bubble: { distance: 120, size: 6, duration: 0.4, opacity: 0.6 },
    },
  },
  detectRetina: true,
};

export default function ParticlesBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const particlesLoaded = useCallback(async () => {}, []);

  if (!ready) return null;

  return (
    <Particles
      id="empty-state-particles"
      className="absolute inset-0 z-0"
      options={OPTIONS}
      particlesLoaded={particlesLoaded}
    />
  );
}
