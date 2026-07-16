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
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 767px)");
    const random = seededRandom(24719);
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
    let particles = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let visible = !document.hidden;

    const makeParticles = () => {
      const count = compactQuery.matches ? 34 : 82;
      particles = Array.from({ length: count }, () => ({
        x: random(),
        y: 0.16 + random() * 0.68,
        radius: 0.45 + random() * 1.75,
        speed: 0.000035 + random() * 0.00012,
        drift: 0.001 + random() * 0.006,
        phase: random() * Math.PI * 2,
        alpha: 0.16 + random() * 0.62,
        layer: 0.25 + random() * 0.75,
      }));
    };

    const resize = () => {
      const bounds = field.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeParticles();
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
        endY,
      );
      context.strokeStyle = `rgba(${index % 5 === 0 ? "84, 231, 223" : "40, 132, 255"}, ${0.055 + lane * 0.045})`;
      context.lineWidth = index % 4 === 0 ? 1.4 : 0.55;
      context.stroke();
    };

    const render = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const reduceMotion = motionQuery.matches;

      pointer.x += (pointer.targetX - pointer.x) * (reduceMotion ? 1 : 0.035);
      pointer.y += (pointer.targetY - pointer.y) * (reduceMotion ? 1 : 0.035);

      const offsetX = (pointer.x - 0.5) * 20;
      const offsetY = (pointer.y - 0.5) * 12;
      field.style.setProperty("--pupil-x", `${offsetX * 0.42}px`);
      field.style.setProperty("--pupil-y", `${offsetY * 0.42}px`);
      field.style.setProperty("--iris-x", `${offsetX * 0.7}px`);
      field.style.setProperty("--iris-y", `${offsetY * 0.7}px`);
      field.style.setProperty("--field-x", `${offsetX}px`);
      field.style.setProperty("--field-y", `${offsetY}px`);

      for (let index = 0; index < 18; index += 1) {
        drawFiber(reduceMotion ? 0 : time, index, offsetX, offsetY);
      }

      particles.forEach((particle) => {
        if (!reduceMotion) particle.x += particle.speed * 16;
        if (particle.x > 1.04) particle.x = -0.04;

        const shimmer = reduceMotion ? 0.75 : 0.48 + Math.sin(time * particle.drift + particle.phase) * 0.38;
        const x = particle.x * width + offsetX * particle.layer;
        const y = particle.y * height + Math.sin(particle.x * Math.PI * 3 + particle.phase) * height * 0.045 + offsetY * particle.layer;
        const alpha = Math.max(0.08, particle.alpha * shimmer);
        const blueGreen = particle.layer > 0.84;

        context.beginPath();
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = blueGreen ? `rgba(80, 224, 210, ${alpha})` : `rgba(125, 188, 255, ${alpha})`;
        context.shadowBlur = particle.radius * 5;
        context.shadowColor = blueGreen ? "#38c8b8" : "#2a8dff";
        context.fill();
        context.shadowBlur = 0;
      });

      if (!reduceMotion && visible) frameId = requestAnimationFrame(render);
    };

    const onPointerMove = (event) => {
      if (motionQuery.matches || compactQuery.matches) return;
      pointer.targetX = event.clientX / window.innerWidth;
      pointer.targetY = event.clientY / window.innerHeight;
    };

    const onPointerLeave = () => {
      pointer.targetX = 0.5;
      pointer.targetY = 0.5;
    };

    const onVisibilityChange = () => {
      visible = !document.hidden;
      cancelAnimationFrame(frameId);
      if (visible) render(performance.now());
    };

    const onMotionChange = () => {
      cancelAnimationFrame(frameId);
      pointer.targetX = 0.5;
      pointer.targetY = 0.5;
      render(performance.now());
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(field);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionQuery.addEventListener("change", onMotionChange);
    compactQuery.addEventListener("change", resize);
    resize();
    render(performance.now());

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionQuery.removeEventListener("change", onMotionChange);
      compactQuery.removeEventListener("change", resize);
    };
  }, []);

  return (
    <div className="eye-field" ref={fieldRef} aria-hidden="true">
      <canvas className="particle-canvas" ref={canvasRef} />

      <svg className="eye-svg" viewBox="0 0 1200 620" role="presentation">
        <defs>
          <linearGradient id="electric-blue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0b4fa8" stopOpacity="0" />
            <stop offset="0.22" stopColor="#1688ff" stopOpacity="0.68" />
            <stop offset="0.55" stopColor="#9bdcff" stopOpacity="0.96" />
            <stop offset="0.82" stopColor="#247fe8" stopOpacity="0.62" />
            <stop offset="1" stopColor="#0b4fa8" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="iris-wash">
            <stop offset="0" stopColor="#030c19" stopOpacity="0.96" />
            <stop offset="0.38" stopColor="#061f35" stopOpacity="0.9" />
            <stop offset="0.72" stopColor="#0b4780" stopOpacity="0.34" />
            <stop offset="1" stopColor="#0b62bd" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="wide-glow" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="18" />
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
          <ellipse className="iris-orbit orbit-one" cx="600" cy="306" rx="196" ry="166" />
          <ellipse className="iris-orbit orbit-two" cx="600" cy="306" rx="172" ry="147" />
          <ellipse className="iris-orbit orbit-three" cx="600" cy="306" rx="146" ry="126" />
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
