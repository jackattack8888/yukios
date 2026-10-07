import { createElement } from "./shared/domUtils.js";
import gsap from "gsap";

const glitchSlice = {
  id: "glitchSlice",
  label: "Glitch Slice",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const logo = overlay.querySelector(".boot-logo");
    const ghosts = [];
    for (const cls of ["boot-glitch-a", "boot-glitch-b"]) {
      const img = createElement("img");
      img.className = `boot-logo boot-glitch ${cls}`;
      img.src = logo.src;
      img.alt = "";
      wrap.prepend(img);
      ghosts.push(img);
    }
    return { ghosts };
  },
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.92 });
    g.set(els.letters, { opacity: 0, x: 14 });
    g.set(els.version, { opacity: 0 });
    g.set(els.extEls.ghosts, { opacity: 0, x: 0 });
  },
  show: (tl, els) => {
    const ghosts = els.extEls.ghosts;
    tl.to(els.overlay, { opacity: 1, duration: 0.25, ease: "power2.out" })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }, "-=0.1")
      .to(ghosts, { opacity: 0.7, duration: 0.08, stagger: 0.06 }, "-=0.3");
    for (let i = 0; i < 5; i++) {
      tl.to(els.logo, { x: i % 2 ? -7 : 7, duration: 0.05, ease: "none" })
        .to(ghosts[0], { x: -10 - i * 2, duration: 0.05, ease: "none" }, "<")
        .to(ghosts[1], { x: 10 + i * 2, duration: 0.05, ease: "none" }, "<");
    }
    tl.to([els.logo, ...ghosts], { x: 0, duration: 0.12, ease: "power3.out" })
      .to(ghosts, { opacity: 0, duration: 0.15 }, "-=0.08")
      .to(els.letters, { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: "power3.out" }, "-=0.15")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    tl.to(els.extEls.ghosts, { opacity: 0.6, x: (i) => (i ? 12 : -12), duration: 0.1 })
      .to([els.logo, ...els.extEls.ghosts], { opacity: 0, x: 0, duration: 0.18, ease: "power2.in" }, "-=0.02")
      .to(els.letters, { opacity: 0, x: -10, duration: 0.15, stagger: 0.02 }, "-=0.15")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.1");
  }
};

const ringPulse = {
  id: "ringPulse",
  label: "Ring Pulse",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const holder = createElement("div");
    holder.className = "boot-ring-holder";
    wrap.prepend(holder);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = createElement("div");
      r.className = "boot-ring";
      holder.appendChild(r);
      rings.push(r);
    }
    return { rings };
  },
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.extEls.rings, { scale: 0.2, opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.6 });
    g.set(els.letters, { opacity: 0, y: 14 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.overlay, { opacity: 1, duration: 0.25, ease: "power2.out" })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.6)" }, "-=0.1")
      .to(
        els.extEls.rings,
        {
          scale: 2.6,
          opacity: 0,
          duration: 1.1,
          stagger: 0.18,
          ease: "power2.out",
          onStart: () => gsap.set(els.extEls.rings, { opacity: 0.8 })
        },
        "-=0.45"
      )
      .to(els.letters, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }, "-=0.9")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.3");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, y: -10, duration: 0.15, stagger: 0.02 })
      .to(els.logo, { opacity: 0, scale: 0.7, duration: 0.2, ease: "power2.in" }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.05");
  }
};

const auroraBloom = {
  id: "auroraBloom",
  label: "Aurora Bloom",
  createExtra: (overlay) => {
    const holder = createElement("div");
    holder.className = "boot-aurora-holder";
    overlay.prepend(holder);
    const blobs = [];
    for (let i = 0; i < 3; i++) {
      const b = createElement("div");
      b.className = `boot-aurora boot-aurora-${i}`;
      holder.appendChild(b);
      blobs.push(b);
    }
    return { blobs };
  },
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.extEls.blobs, { opacity: 0, scale: 0.7 });
    g.set(els.logo, { opacity: 0, scale: 0.85, filter: "blur(14px)" });
    g.set(els.letters, { opacity: 0, y: 12, filter: "blur(6px)" });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const blobs = els.extEls.blobs;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(blobs, { opacity: 0.9, scale: 1.15, duration: 1.2, stagger: 0.12, ease: "sine.inOut" }, "-=0.15")
      .to(blobs, { x: (i) => [40, -50, 20][i], y: (i) => [-30, 25, 45][i], duration: 1.2, ease: "sine.inOut" }, "<")
      .to(els.logo, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "power2.out" }, "-=1.0")
      .to(els.letters, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.4, stagger: 0.06 }, "-=0.5")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.2");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, duration: 0.15, stagger: 0.02 })
      .to(els.logo, { opacity: 0, scale: 1.06, filter: "blur(10px)", duration: 0.25 }, "-=0.1")
      .to(els.extEls.blobs, { opacity: 0, scale: 1.3, duration: 0.3 }, "-=0.2")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.2");
  }
};

const crtPower = {
  id: "crtPower",
  label: "CRT Power",
  createExtra: (overlay) => {
    const line = createElement("div");
    line.className = "boot-crt-line";
    overlay.appendChild(line);
    const flash = createElement("div");
    flash.className = "boot-crt-flash";
    overlay.appendChild(flash);
    return { line, flash };
  },
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 1 });
    g.set(els.extEls.line, { scaleX: 0, scaleY: 1, opacity: 1 });
    g.set(els.extEls.flash, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scaleY: 0.02, scaleX: 1.4 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.extEls.line, { scaleX: 1, duration: 0.3, ease: "power3.in" })
      .to(els.extEls.line, { scaleY: 0.02, duration: 0.12, ease: "power2.in" })
      .to(els.extEls.flash, { opacity: 1, duration: 0.06 }, "-=0.05")
      .to(els.extEls.line, { opacity: 0, duration: 0.1 }, "<")
      .to(els.extEls.flash, { opacity: 0, duration: 0.15 }, "<")
      .to(els.logo, { opacity: 1, scaleY: 1, scaleX: 1, duration: 0.35, ease: "power3.out" }, "-=0.15")
      .to(els.logo, { scaleY: 1.06, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut" })
      .to(els.letters, { opacity: 1, duration: 0.3, stagger: 0.05 }, "-=0.15")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02 })
      .to(els.logo, { scaleY: 0.02, scaleX: 1.5, opacity: 0, duration: 0.25, ease: "power3.in" }, "-=0.05")
      .to(els.extEls.line, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.1 }, "-=0.05")
      .to(els.extEls.line, { scaleX: 0, opacity: 0, duration: 0.2 })
      .to(els.overlay, { opacity: 0, duration: 0.25 }, "-=0.1");
  }
};

const emberIgnite = {
  id: "emberIgnite",
  label: "Ember Ignite",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const holder = createElement("div");
    holder.className = "boot-ember-holder";
    wrap.prepend(holder);
    const embers = [];
    for (let i = 0; i < 22; i++) {
      const el = createElement("div");
      el.className = "boot-ember";
      holder.appendChild(el);
      embers.push(el);
    }
    return { emberHolder: holder, embers };
  },
  setup: (els) => {
    const g = gsap;
    const { embers } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(embers, { x: 0, y: 0, scale: 1, opacity: 1 });
    g.set(els.logo, { opacity: 0, scale: 1.25, filter: "brightness(2.2)" });
    g.set(els.letters, { opacity: 0, y: 12 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { embers } = els.extEls;
    const count = embers.length;
    tl.to(els.overlay, { opacity: 1, duration: 0.2, ease: "power2.out" })
      .to(els.logo, { opacity: 1, scale: 1, filter: "brightness(1)", duration: 0.6, ease: "power3.out" }, "-=0.05")
      .to(
        embers,
        {
          x: (i) => Math.cos((i / count) * Math.PI * 2) * (90 + (i % 4) * 30),
          y: (i) => Math.sin((i / count) * Math.PI * 2) * (90 + (i % 4) * 30),
          scale: 0,
          opacity: 0,
          duration: 0.9,
          stagger: 0.015,
          ease: "power3.out"
        },
        "-=0.5"
      )
      .to(els.letters, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06 }, "-=0.7")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.2");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, y: -12, duration: 0.15, stagger: 0.02 })
      .to(els.logo, { opacity: 0, scale: 0.8, filter: "brightness(2)", duration: 0.25 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.05");
  }
};

const current = {
  id: "current",
  label: "Current",
  createExtra: () => null,
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0, y: 16 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.4)" }, "-=0.1")
      .to(els.letters, { opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.35, ease: "power2.out" }, "-=0.15");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, y: -12, duration: 0.15, stagger: 0.03, ease: "power2.in" })
      .to(els.logo, { opacity: 0, scale: 0.6, duration: 0.15, ease: "power2.in" }, "-=0.1")
      .to(els.overlay, { opacity: 0, scale: 1.04, duration: 0.35, ease: "power2.inOut" }, "-=0.1");
  }
};

const digitalScan = {
  id: "digitalScan",
  label: "Digital Scan",
  createExtra: (overlay) => {
    const sl = createElement("div");
    sl.className = "boot-scanline";
    overlay.appendChild(sl);
    return { scanline: sl };
  },
  setup: (els) => {
    const g = gsap;
    const { scanline } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(scanline, { top: "-3px", opacity: 1 });
    g.set(els.logo, { opacity: 0, y: -8, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { scanline } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.2, ease: "power2.out" })
      .to(scanline, { top: "100%", duration: 0.9, ease: "power2.inOut" }, "-=0.1")
      .to(els.logo, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" }, "-=0.6")
      .to(els.letters, { opacity: 1, duration: 0.35, stagger: 0.06, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { scanline } = els.extEls;
    gsap.set(scanline, { top: "100%", opacity: 1 });
    tl.to(scanline, { top: "110%", duration: 0.15, ease: "power2.in" })
      .to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02, ease: "power2.in" }, "-=0.05")
      .to(els.logo, { opacity: 0, duration: 0.1, ease: "power2.in" }, "-=0.08")
      .to(els.overlay, { opacity: 0, duration: 0.3, ease: "power2.inOut" }, "-=0.15");
  }
};

const orbitalConverge = {
  id: "orbitalConverge",
  label: "Orbital Converge",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const pc = createElement("div");
    pc.className = "boot-particles-container";
    wrap.prepend(pc);

    const count = 16;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const el = createElement("div");
      el.className = "boot-particle";
      pc.appendChild(el);
      particles.push(el);
    }
    return { particlesContainer: pc, particles };
  },
  setup: (els) => {
    const g = gsap;
    const { particles } = els.extEls;
    const count = particles.length;
    g.set(els.overlay, { opacity: 0 });
    g.set(particles, {
      x: (i) => Math.cos((i / count) * Math.PI * 2) * 140,
      y: (i) => Math.sin((i / count) * Math.PI * 2) * 140,
      scale: 1,
      opacity: 0.9
    });
    g.set(els.logo, { opacity: 0, scale: 0.3 });
    g.set(els.letters, { opacity: 0, y: 20 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { particles } = els.extEls;
    const count = particles.length;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        particles,
        {
          x: 0,
          y: 0,
          scale: 0,
          opacity: 0,
          duration: 1.1,
          stagger: 0.03,
          ease: "power4.in"
        },
        "-=0.1"
      )
      .to(
        els.logo,
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: "back.out(2.5)"
        },
        "-=0.4"
      )
      .to(els.letters, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }, "-=0.3")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { particles } = els.extEls;
    const count = particles.length;
    gsap.set(particles, { x: 0, y: 0, scale: 1, opacity: 1 });
    tl.to(els.letters, { opacity: 0, y: -15, duration: 0.15, stagger: 0.03, ease: "power2.in" })
      .to(els.logo, { opacity: 0, scale: 0.3, duration: 0.15, ease: "power2.in" }, "-=0.1")
      .to(
        particles,
        {
          x: (i) => Math.cos((i / count) * Math.PI * 2) * 200,
          y: (i) => Math.sin((i / count) * Math.PI * 2) * 200,
          scale: 0.3,
          opacity: 0,
          duration: 0.4,
          stagger: 0.02,
          ease: "power2.out"
        },
        "-=0.2"
      )
      .to(els.overlay, { opacity: 0, duration: 0.35 }, "-=0.3");
  }
};

const lightBeam = {
  id: "lightBeam",
  label: "Light Beam",
  createExtra: (overlay) => {
    const beam = createElement("div");
    beam.className = "boot-light-beam";
    overlay.appendChild(beam);
    return { beam };
  },
  setup: (els) => {
    const g = gsap;
    const { beam } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(beam, { left: "-80px", opacity: 1 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { beam } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(beam, { left: "100vw", duration: 0.7, ease: "power2.inOut" }, "-=0.1")
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.3 }, "-=0.4")
      .to(els.letters, { opacity: 1, duration: 0.25, stagger: 0.05 }, "-=0.25")
      .to(els.version, { opacity: 1, duration: 0.25 }, "-=0.1")
      .to(beam, { opacity: 0, duration: 0.2 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { beam } = els.extEls;
    tl.to(beam, { opacity: 1, duration: 0.05 })
      .to(beam, { left: "-80px", duration: 0.4, ease: "power2.in" })
      .to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02 }, "-=0.2")
      .to(els.logo, { opacity: 0, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

const gravityDrop = {
  id: "gravityDrop",
  label: "Gravity Drop",
  createExtra: () => null,
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, y: -80, scale: 0.5 });
    g.set(els.letters, {
      opacity: 1,
      y: -120,
      rotation: (i) => (Math.random() - 0.5) * 30
    });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        els.letters,
        {
          y: 0,
          rotation: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "elastic.out(1, 0.4)"
        },
        "-=0.1"
      )
      .to(
        els.logo,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "elastic.out(1, 0.35)"
        },
        "-=0.3"
      )
      .to(els.version, { opacity: 1, duration: 0.35 }, "-=0.15");
  },
  hide: (tl, els) => {
    tl.to(els.letters, {
      y: -60,
      opacity: 0,
      duration: 0.3,
      stagger: 0.03,
      ease: "power2.in"
    })
      .to(els.logo, { y: -40, opacity: 0, duration: 0.25 }, "-=0.2")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.2");
  }
};

const pixelate = {
  id: "pixelate",
  label: "Pixelate",
  createExtra: (overlay) => {
    const wrap = overlay.querySelector(".boot-logo-wrap");
    const grid = createElement("div");
    grid.className = "boot-pixel-grid";
    wrap.prepend(grid);

    const cols = 5;
    const rows = 5;
    const blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const block = createElement("div");
        block.className = "boot-pixel-block";
        block.style.left = `${(c / cols) * 100}%`;
        block.style.top = `${(r / rows) * 100}%`;
        block.style.width = `${100 / cols}%`;
        block.style.height = `${100 / rows}%`;
        grid.appendChild(block);
        blocks.push(block);
      }
    }
    return { pixelGrid: grid, blocks };
  },
  setup: (els) => {
    const g = gsap;
    const { blocks } = els.extEls;
    g.set(els.overlay, { opacity: 0 });
    g.set(blocks, { scale: 1, opacity: 1 });
    g.set(els.logo, { opacity: 0, scale: 0.5 });
    g.set(els.letters, { opacity: 0 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { blocks } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(blocks, {
        scale: 0,
        opacity: 0,
        duration: 0.6,
        stagger: 0.02,
        ease: "power2.inOut"
      })
      .to(els.logo, { opacity: 1, scale: 1, duration: 0.4 }, "-=0.15")
      .to(els.letters, { opacity: 1, duration: 0.3, stagger: 0.05 }, "-=0.15")
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    tl.to(els.letters, { opacity: 0, duration: 0.1, stagger: 0.02 }, "-=0.2")
      .to(els.logo, { opacity: 0, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

const typewriter = {
  id: "typewriter",
  label: "Typewriter",
  createExtra: (overlay) => {
    const brand = overlay.querySelector(".boot-brand");
    const cursor = createElement("span");
    cursor.className = "boot-cursor";
    brand.appendChild(cursor);
    return { cursor };
  },
  setup: (els) => {
    const g = gsap;
    g.set(els.overlay, { opacity: 0 });
    g.set(els.logo, { opacity: 0, scale: 0.5, y: 12 });
    g.set(els.letters, {
      opacity: 0,
      scale: 0.7,
      y: 10
    });
    g.set(els.extEls.cursor, { opacity: 1 });
    g.set(els.version, { opacity: 0 });
  },
  show: (tl, els) => {
    const { cursor } = els.extEls;
    tl.to(els.overlay, { opacity: 1, duration: 0.3, ease: "power2.out" })
      .to(
        els.letters,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.12,
          ease: "back.out(1.7)"
        },
        "-=0.1"
      )
      .to(cursor, { opacity: 0, duration: 0.1 }, "+=0.15")
      .to(
        els.logo,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.4,
          ease: "back.out(1.3)"
        },
        "-=0.1"
      )
      .to(els.version, { opacity: 1, duration: 0.3 }, "-=0.1");
  },
  hide: (tl, els) => {
    const { cursor } = els.extEls;
    tl.to(els.letters, {
      opacity: 0,
      scale: 0.6,
      y: -6,
      duration: 0.15,
      stagger: 0.04,
      ease: "power2.in"
    })
      .to(cursor, { opacity: 1, duration: 0.1 }, "-=0.2")
      .to(els.logo, { opacity: 0, scale: 0.6, y: -8, duration: 0.1 }, "-=0.1")
      .to(els.overlay, { opacity: 0, duration: 0.3 }, "-=0.15");
  }
};

export const BOOT_ANIMATIONS = [
  glitchSlice,
  ringPulse,
  auroraBloom,
  crtPower,
  emberIgnite,
  current,
  digitalScan,
  orbitalConverge,
  lightBeam,
  gravityDrop,
  pixelate,
  typewriter
];

export function pickAnimation(preferredId) {
  if (preferredId) {
    const found = BOOT_ANIMATIONS.find((a) => a.id === preferredId);
    if (found) return found;
  }
  return BOOT_ANIMATIONS[Math.floor(Math.random() * BOOT_ANIMATIONS.length)];
}
