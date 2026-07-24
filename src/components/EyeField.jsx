import { useEffect, useRef } from "react";

const irisFibers = Array.from({ length: 52 }, (_, index) => {
  const angle = (index / 52) * Math.PI * 2;
  const inner = 78 + (index % 4) * 4;
  const outer = 142 + (index % 7) * 7;
  return {
    x1: 600 + Math.cos(angle) * inner,
    y1: 306 + Math.sin(angle) * inner * 0.86,
    x2: 600 + Math.cos(angle) * outer,
    y2: 306 + Math.sin(angle) * outer * 0.77,
    opacity: 0.22 + (index % 6) * 0.075,
  };
});

function seededRandom(seed) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export default function EyeField() {
  const fieldRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const field = fieldRef.current;
    const canvas = canvasRef.current;
    if (!field || !canvas) return undefined;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return undefined;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 767px)");
    
    // Physics state using spring damping
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 };
    let gazeLocked = false;
    let particles = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let visible = !document.hidden;
    let lastMoveTime = performance.now();
    let pupilScale = 1;

    const makeParticles = () => {
      const count = compactQuery.matches ? 22 : 48;
      const random = seededRandom(24719 + count);
      particles = Array.from({ length: count }, () => ({
        x: random(),
        y: 0.14 + random() * 0.72,
        z: 0.2 + random() * 0.8, // 3D depth layer
        radius: 0.5 + random() * 1.8,
        speed: 0.00004 + random() * 0.00014,
        drift: 0.001 + random() * 0.005,
        phase: random() * Math.PI * 2,
        alpha: 0.18 + random() * 0.65,
        blueGreen: random() > 0.45,
      }));
    };

    const resize = () => {
      const bounds = field.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeParticles();
    };

    // Draw 3D Spatial Hologram Orbital HUD Rings
    const drawHolographicHUD = (time, cx, cy, radiusX, radiusY) => {
      context.save();
      context.translate(cx, cy);

      // Outer Rotating HUD Ring (Clockwise)
      const rot1 = time * 0.00018;
      context.save();
      context.rotate(rot1);
      context.beginPath();
      context.ellipse(0, 0, radiusX * 1.22, radiusY * 1.22, 0, 0, Math.PI * 2);
      context.strokeStyle = "rgba(0, 106, 77, 0.14)";
      context.lineWidth = 1;
      context.setLineDash([4, 12]);
      context.stroke();

      // Tick marks on Outer HUD ring
      const ticks = 12;
      for (let i = 0; i < ticks; i += 1) {
        const a = (i / ticks) * Math.PI * 2;
        const tx1 = Math.cos(a) * (radiusX * 1.2);
        const ty1 = Math.sin(a) * (radiusY * 1.2);
        const tx2 = Math.cos(a) * (radiusX * 1.25);
        const ty2 = Math.sin(a) * (radiusY * 1.25);
        context.beginPath();
        context.moveTo(tx1, ty1);
        context.lineTo(tx2, ty2);
        context.strokeStyle = i % 4 === 0 ? "rgba(126, 184, 154, 0.35)" : "rgba(0, 106, 77, 0.16)";
        context.lineWidth = i % 4 === 0 ? 1.2 : 0.7;
        context.stroke();
      }
      context.restore();

      // Inner Counter-Rotating HUD Ring (Counter-Clockwise)
      const rot2 = -time * 0.00024;
      context.save();
      context.rotate(rot2);
      context.beginPath();
      context.ellipse(0, 0, radiusX * 0.88, radiusY * 0.88, 0, 0, Math.PI * 2);
      context.strokeStyle = "rgba(126, 184, 154, 0.14)";
      context.lineWidth = 0.8;
      context.setLineDash([8, 16]);
      context.stroke();
      context.restore();

      context.restore();
    };

    // Draw 3D Specular Eye Lens & Normal-Mapped Lighting Glint
    const draw3DSphericalSpecular = (cx, cy, radius, lightX, lightY) => {
      context.save();
      // Calculate specular highlight center based on light vector (N . L)
      const specX = cx + lightX * radius * 0.45;
      const specY = cy + lightY * radius * 0.42;
      const specGrad = context.createRadialGradient(
        specX,
        specY,
        2,
        specX,
        specY,
        radius * 0.55
      );
      specGrad.addColorStop(0, "rgba(230, 245, 238, 0.45)");
      specGrad.addColorStop(0.25, "rgba(126, 184, 154, 0.18)");
      specGrad.addColorStop(0.65, "rgba(0, 106, 77, 0.06)");
      specGrad.addColorStop(1, "rgba(0, 106, 77, 0)");

      context.beginPath();
      context.ellipse(cx, cy, radius * 1.05, radius * 0.85, 0, 0, Math.PI * 2);
      context.fillStyle = specGrad;
      context.fill();

      // Secondary Rim Light
      const rimX = cx - lightX * radius * 0.38;
      const rimY = cy - lightY * radius * 0.35;
      const rimGrad = context.createRadialGradient(
        rimX,
        rimY,
        radius * 0.4,
        rimX,
        rimY,
        radius * 0.95
      );
      rimGrad.addColorStop(0, "rgba(126, 184, 154, 0)");
      rimGrad.addColorStop(0.7, "rgba(0, 106, 77, 0.05)");
      rimGrad.addColorStop(1, "rgba(0, 106, 77, 0.14)");

      context.beginPath();
      context.ellipse(cx, cy, radius * 0.98, radius * 0.8, 0, 0, Math.PI * 2);
      context.fillStyle = rimGrad;
      context.fill();

      context.restore();
    };

    const drawFiber = (time, index, parallaxX, parallaxY) => {
      const lane = index / 17;
      const upper = index % 2 === 0;
      const direction = upper ? -1 : 1;
      const pulse = Math.sin(time * 0.0002 + index * 0.93) * 7;
      const yCenter = height * 0.49;
      const startX = width * (0.03 + lane * 0.08) + parallaxX * (0.2 + lane);
      const endX = width * (0.95 - lane * 0.025) + parallaxX * (1.1 - lane * 0.2);
      const startY = yCenter + direction * height * (0.04 + lane * 0.14) + pulse + parallaxY;
      const endY = yCenter + direction * height * (0.02 + lane * 0.12) - pulse * 0.6 + parallaxY;

      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(
        width * 0.28,
        yCenter + direction * height * (0.34 - lane * 0.08) + pulse,
        width * 0.72,
        yCenter + direction * height * (0.34 - lane * 0.08) - pulse,
        endX,
        endY
      );
      context.strokeStyle = `rgba(${index % 5 === 0 ? "126, 184, 154" : "0, 106, 77"}, ${0.04 + lane * 0.035})`;
      context.lineWidth = index % 4 === 0 ? 1.4 : 0.55;
      context.stroke();
    };

    const render = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const reduceMotion = motionQuery.matches;
      field.dataset.motion = reduceMotion ? "reduced" : "full";

      // Idle micro-saccadic movements when user is inactive
      const idle = time - lastMoveTime > 1600;
      if (!reduceMotion && idle && !gazeLocked) {
        pointer.targetX = Math.sin(time * 0.0012) * 0.08 * Math.cos(time * 0.0007);
        pointer.targetY = Math.cos(time * 0.0015) * 0.06;
      }

      // Spring-damper gaze interpolation: a = -k*(x - target) - c*v
      if (reduceMotion) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        pointer.vx = 0;
        pointer.vy = 0;
      } else {
        pointer.vx += (pointer.targetX - pointer.x) * 0.06 - pointer.vx * 0.24;
        pointer.vy += (pointer.targetY - pointer.y) * 0.06 - pointer.vy * 0.24;
        pointer.x += pointer.vx;
        pointer.y += pointer.vy;
      }

      const targetScale = gazeLocked ? 1.25 : 1.0;
      pupilScale += (targetScale - pupilScale) * (reduceMotion ? 1 : 0.06);

      const offsetX = pointer.x * (compactQuery.matches ? 18 : 38);
      const offsetY = pointer.y * (compactQuery.matches ? 10 : 22);

      field.style.setProperty("--pupil-x", `${offsetX * 0.72}px`);
      field.style.setProperty("--pupil-y", `${offsetY * 0.72}px`);
      field.style.setProperty("--pupil-scale", `${pupilScale}`);
      field.style.setProperty("--iris-x", `${offsetX * 0.38}px`);
      field.style.setProperty("--iris-y", `${offsetY * 0.38}px`);
      field.style.setProperty("--field-x", `${offsetX * 0.12}px`);
      field.style.setProperty("--field-y", `${offsetY * 0.12}px`);
      field.style.setProperty("--tilt-x", `${-pointer.y * 7}deg`);
      field.style.setProperty("--tilt-y", `${pointer.x * 9}deg`);

      const cx = width * 0.5 + offsetX * 0.38;
      const cy = height * 0.4935 + offsetY * 0.38;
      const radiusX = Math.min(width, height) * 0.28;
      const radiusY = radiusX * 0.82;

      // Draw Spatial Hologram HUD Rings & 3D Specular Lens
      if (!reduceMotion) {
        drawHolographicHUD(time, cx, cy, radiusX, radiusY);
        draw3DSphericalSpecular(cx, cy, radiusX * 0.9, pointer.x, pointer.y);
      }

      // Draw Fiber Arcs
      for (let index = 0; index < 18; index += 1) {
        drawFiber(reduceMotion ? 0 : time, index, offsetX, offsetY);
      }

      // Draw 3D Spatial Particle Field & Constellations
      const activeParticles = [];
      particles.forEach((particle) => {
        if (!reduceMotion) particle.x += particle.speed * 16;
        if (particle.x > 1.04) particle.x = -0.04;

        const shimmer = reduceMotion ? 0.75 : 0.48 + Math.sin(time * particle.drift + particle.phase) * 0.38;
        const parallaxMult = particle.z * 1.2;
        const x = particle.x * width + offsetX * parallaxMult;
        const y = particle.y * height + Math.sin(particle.x * Math.PI * 3 + particle.phase) * height * 0.045 + offsetY * parallaxMult;
        const alpha = Math.max(0.08, particle.alpha * shimmer);
        const blueGreen = particle.blueGreen;

        activeParticles.push({ x, y, alpha, blueGreen, z: particle.z });

        context.beginPath();
        context.arc(x, y, particle.radius * particle.z, 0, Math.PI * 2);
        context.fillStyle = blueGreen ? `rgba(126, 184, 154, ${alpha * 0.7})` : `rgba(0, 106, 77, ${alpha * 0.55})`;
        context.shadowBlur = particle.radius * 2 * particle.z;
        context.shadowColor = blueGreen ? "#5fa887" : "#006a4d";
        context.fill();
        context.shadowBlur = 0;
      });

      // Spatial Constellation Lines
      if (!reduceMotion && activeParticles.length > 0) {
        const threshold = compactQuery.matches ? 45 : 72;
        const len = activeParticles.length;
        for (let i = 0; i < len; i += 1) {
          for (let j = i + 1; j < len; j += 1) {
            const dx = activeParticles[i].x - activeParticles[j].x;
            const dy = activeParticles[i].y - activeParticles[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < threshold) {
              const lineAlpha = (1 - dist / threshold) * 0.2 * activeParticles[i].alpha * activeParticles[i].z;
              context.beginPath();
              context.moveTo(activeParticles[i].x, activeParticles[i].y);
              context.lineTo(activeParticles[j].x, activeParticles[j].y);
              context.strokeStyle = activeParticles[i].blueGreen
                ? `rgba(64, 230, 215, ${lineAlpha})`
                : `rgba(90, 175, 255, ${lineAlpha})`;
              context.lineWidth = 0.65;
              context.stroke();
            }
          }
        }
      }

      if (!reduceMotion && visible) frameId = requestAnimationFrame(render);
    };

    const setGazeTarget = (clientX, clientY) => {
      lastMoveTime = performance.now();
      const bounds = field.getBoundingClientRect();
      const eyeX = bounds.left + bounds.width / 2;
      const eyeY = bounds.top + bounds.height * 0.4935;
      let x = (clientX - eyeX) / Math.max(1, bounds.width * 0.42);
      let y = (clientY - eyeY) / Math.max(1, bounds.height * 0.38);
      const distance = Math.hypot(x, y);
      if (distance > 1) {
        x /= distance;
        y /= distance;
      }
      pointer.targetX = x;
      pointer.targetY = y;
    };

    const onPointerMove = (event) => {
      if (motionQuery.matches || compactQuery.matches || gazeLocked) return;
      setGazeTarget(event.clientX, event.clientY);
    };

    const onDirectedGaze = (event) => {
      gazeLocked = Boolean(event.detail?.locked);
      if (gazeLocked && Number.isFinite(event.detail?.clientX) && Number.isFinite(event.detail?.clientY)) {
        setGazeTarget(event.detail.clientX, event.detail.clientY);
      } else {
        pointer.targetX = 0;
        pointer.targetY = 0;
      }
    };

    const onPointerLeave = () => {
      if (gazeLocked) return;
      pointer.targetX = 0;
      pointer.targetY = 0;
    };

    const onVisibilityChange = () => {
      visible = !document.hidden;
      cancelAnimationFrame(frameId);
      if (visible) render(performance.now());
    };

    const onMotionChange = () => {
      cancelAnimationFrame(frameId);
      pointer.targetX = 0;
      pointer.targetY = 0;
      render(performance.now());
    };

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(field);
    if (!resizeObserver) window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("faculty-eye-gaze", onDirectedGaze);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
    compactQuery.addEventListener("change", resize);
    resize();
    render(performance.now());

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("faculty-eye-gaze", onDirectedGaze);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      compactQuery.removeEventListener("change", resize);
    };
  }, []);

  return (
    <div className="eye-field" ref={fieldRef} aria-hidden="true" data-seed="24719">
      <canvas className="particle-canvas" ref={canvasRef} />

      <svg className="eye-svg" viewBox="0 0 1200 620" role="presentation">
        <defs>
          <linearGradient id="electric-blue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#004d38" stopOpacity="0" />
            <stop offset="0.22" stopColor="#006a4d" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#7eb89a" stopOpacity="0.85" />
            <stop offset="0.82" stopColor="#2a7a5c" stopOpacity="0.5" />
            <stop offset="1" stopColor="#004d38" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="iris-wash">
            <stop offset="0" stopColor="#081612" stopOpacity="0.94" />
            <stop offset="0.38" stopColor="#0c1f1a" stopOpacity="0.88" />
            <stop offset="0.72" stopColor="#006a4d" stopOpacity="0.28" />
            <stop offset="1" stopColor="#2a7a5c" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wide-glow" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <g className="membranes">
          <path d="M67 313 C250 63 780 16 1141 296 C880 156 369 151 67 313Z" />
          <path d="M67 313 C309 586 823 593 1141 296 C848 452 342 457 67 313Z" />
        </g>

        <g className="eye-parallax">
          <path className="lid-glow lid-glow-wide" d="M67 313 C250 63 780 16 1141 296" />
          <path className="lid-glow lid-glow-wide" d="M67 313 C309 586 823 593 1141 296" />
          <path className="lid-line lid-line-primary" d="M67 313 C250 63 780 16 1141 296" />
          <path className="lid-line lid-line-primary lower" d="M67 313 C309 586 823 593 1141 296" />
          <path className="lid-line lid-line-fine" d="M112 284 C342 92 779 72 1094 273" />
          <path className="lid-line lid-line-fine" d="M116 342 C366 528 800 520 1082 320" />
          <path className="lid-line lid-line-ghost" d="M138 255 C372 116 759 87 1038 242" />
          <path className="lid-line lid-line-ghost" d="M145 373 C411 493 797 473 1038 347" />
        </g>

        <g className="iris-parallax">
          <ellipse className="iris-wash" cx="600" cy="306" rx="242" ry="198" />
          <ellipse className="iris-orbit orbit-one orbit-spin-cw" cx="600" cy="306" rx="196" ry="166" />
          <ellipse className="iris-orbit orbit-two orbit-spin-ccw" cx="600" cy="306" rx="172" ry="147" />
          <ellipse className="iris-orbit orbit-three orbit-spin-cw" cx="600" cy="306" rx="146" ry="126" />
          <g className="iris-fibers">
            {irisFibers.map((fiber, index) => (
              <line
                key={index}
                x1={fiber.x1}
                y1={fiber.y1}
                x2={fiber.x2}
                y2={fiber.y2}
                style={{ opacity: fiber.opacity }}
              />
            ))}
          </g>
        </g>
      </svg>

      <div className="pupil-cluster">
        <span className="pupil-halo" />
        <span className="pupil-disc" />
        <img
          src="/cleveland-clinic-symbol.png"
          alt=""
          width="188"
          height="106"
          decoding="async"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
