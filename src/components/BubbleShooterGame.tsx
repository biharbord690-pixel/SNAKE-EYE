import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RotateCcw, Volume2, VolumeX, Award, Gamepad2, Mic, MicOff } from "lucide-react";

interface BubbleShooterGameProps {
  isVoiceActive?: boolean;
  toggleVoiceSession?: () => void;
}

// Synthesize sound effects using Web Audio API
const playSound = (type: "shoot" | "pop" | "bounce" | "gameover" | "victory" | "drop") => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === "shoot") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "pop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === "bounce") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === "drop") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "victory") {
      // Ascending cute arpeggio
      const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.15);
      });
    } else if (type === "gameover") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    }
  } catch (err) {
    console.warn("Audio synthesis error:", err);
  }
};

const BUBBLE_COLORS = [
  { key: "pink", value: "#ff007f", glow: "rgba(255, 0, 127, 0.75)" },
  { key: "cyan", value: "#00f3ff", glow: "rgba(0, 243, 255, 0.75)" },
  { key: "yellow", value: "#ffd700", glow: "rgba(255, 215, 0, 0.75)" },
  { key: "purple", value: "#bd53ed", glow: "rgba(189, 83, 237, 0.75)" },
  { key: "orange", value: "#ff4d6d", glow: "rgba(255, 77, 109, 0.75)" }
];

const getRandomColor = () => {
  const idx = Math.floor(Math.random() * BUBBLE_COLORS.length);
  return BUBBLE_COLORS[idx];
};

interface GridBubble {
  colorKey: string;
  colorValue: string;
}

interface FiredBubble {
  x: number;
  y: number;
  colorKey: string;
  colorValue: string;
  dx: number;
  dy: number;
}

export function BubbleShooterGame({ isVoiceActive, toggleVoiceSession }: BubbleShooterGameProps) {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [gameState, setGameState] = useState<"playing" | "gameover" | "victory">("playing");

  const [grid, setGrid] = useState<Record<string, GridBubble>>({});
  const [currentBubble, setCurrentBubble] = useState(() => getRandomColor());
  const [nextBubble, setNextBubble] = useState(() => getRandomColor());
  const [firedBubble, setFiredBubble] = useState<FiredBubble | null>(null);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2); // Straight up
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Constants
  const BUBBLE_RADIUS = 14;
  const BUBBLE_DIAMETER = 28;
  const BOARD_WIDTH = 320;
  const BOARD_HEIGHT = 380;
  const SHOOTER_X = 160;
  const SHOOTER_Y = 350;
  const BUBBLE_SPEED = 16;

  // Hexagonal grid geometry coordinates
  const getBubbleCoords = (r: number, c: number) => {
    const isOdd = r % 2 === 1;
    // Odd rows offset by radius (14px). Columns centered.
    const x = 16 + c * 29 + (isOdd ? 14 : 0);
    const y = 16 + r * 25; // Hex row height is ~0.866 of diameter
    return { x, y };
  };

  // Get total columns for row type
  const getColsCount = (r: number) => {
    return r % 2 === 1 ? 9 : 10;
  };

  // Start / Reset Game
  const initGame = () => {
    const initialGrid: Record<string, GridBubble> = {};
    // Pre-fill top 4 rows with beautiful colored bubbles
    for (let r = 0; r < 4; r++) {
      const cols = getColsCount(r);
      for (let c = 0; c < cols; c++) {
        // Leave some empty spaces for organic shape in row 3
        if (r === 3 && Math.random() > 0.7) continue;
        const colorObj = getRandomColor();
        initialGrid[`${r},${c}`] = {
          colorKey: colorObj.key,
          colorValue: colorObj.value
        };
      }
    }
    setGrid(initialGrid);
    setScore(0);
    setGameState("playing");
    setFiredBubble(null);
    setCurrentBubble(getRandomColor());
    setNextBubble(getRandomColor());
    if (!isMuted) playSound("victory");
  };

  useEffect(() => {
    initGame();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Neighbors lookup for hexagonal grid connectivity check
  const getNeighbors = (r: number, c: number) => {
    const isOdd = r % 2 === 1;
    if (isOdd) {
      return [
        { r, c: c - 1 }, // Left
        { r, c: c + 1 }, // Right
        { r: r - 1, c }, // Top-Left
        { r: r - 1, c: c + 1 }, // Top-Right
        { r: r + 1, c }, // Bottom-Left
        { r: r + 1, c: c + 1 }  // Bottom-Right
      ];
    } else {
      return [
        { r, c: c - 1 }, // Left
        { r, c: c + 1 }, // Right
        { r: r - 1, c: c - 1 }, // Top-Left
        { r: r - 1, c }, // Top-Right
        { r: r + 1, c: c - 1 }, // Bottom-Left
        { r: r + 1, c }  // Bottom-Right
      ];
    }
  };

  // BFS to find matching color clusters
  const findCluster = (startR: number, startC: number, colorKey: string, currentGrid: Record<string, GridBubble>) => {
    const queue: { r: number; c: number }[] = [{ r: startR, c: startC }];
    const visited = new Set<string>();
    visited.add(`${startR},${startC}`);
    const cluster: { r: number; c: number }[] = [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      cluster.push(curr);

      const neighbors = getNeighbors(curr.r, curr.c);
      for (const n of neighbors) {
        const key = `${n.r},${n.c}`;
        if (!visited.has(key) && currentGrid[key] && currentGrid[key].colorKey === colorKey) {
          visited.add(key);
          queue.push(n);
        }
      }
    }
    return cluster;
  };

  // Find floating disconnected bubbles that must fall
  const dropDisconnectedBubbles = (currentGrid: Record<string, GridBubble>) => {
    const connectedToCeiling = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    // Find all row 0 bubbles present on the ceiling and start search from there
    const colsInRow0 = getColsCount(0);
    for (let c = 0; c < colsInRow0; c++) {
      const key = `0,${c}`;
      if (currentGrid[key]) {
        connectedToCeiling.add(key);
        queue.push({ r: 0, c });
      }
    }

    // Traverse all connected bubbles using BFS
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = getNeighbors(curr.r, curr.c);
      for (const n of neighbors) {
        const key = `${n.r},${n.c}`;
        if (!connectedToCeiling.has(key) && currentGrid[key]) {
          connectedToCeiling.add(key);
          queue.push(n);
        }
      }
    }

    // Identify disconnected ones to pop
    const updatedGrid = { ...currentGrid };
    let dropCount = 0;
    for (const key of Object.keys(currentGrid)) {
      if (!connectedToCeiling.has(key)) {
        delete updatedGrid[key];
        dropCount++;
      }
    }
    return { grid: updatedGrid, dropCount };
  };

  // Snap fired bubble into nearest empty grid location
  const snapToGrid = (x: number, y: number, colorKey: string, colorValue: string) => {
    let closestRow = -1;
    let closestCol = -1;
    let minDistance = Infinity;

    // Search rows up to max grid size
    for (let r = 0; r < 12; r++) {
      const cols = getColsCount(r);
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;
        if (grid[key]) continue; // Slot occupied

        const coords = getBubbleCoords(r, c);
        const dist = Math.hypot(x - coords.x, y - coords.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestRow = r;
          closestCol = c;
        }
      }
    }

    if (closestRow !== -1 && closestCol !== -1) {
      const targetKey = `${closestRow},${closestCol}`;
      const tempGrid = { ...grid, [targetKey]: { colorKey, colorValue } };

      // Find color cluster of matching keys
      const matchCluster = findCluster(closestRow, closestCol, colorKey, tempGrid);

      if (matchCluster.length >= 3) {
        // Pop them!
        matchCluster.forEach(item => {
          delete tempGrid[`${item.r},${item.c}`];
        });

        // Drop isolated bubbles that have no connection to row 0
        const result = dropDisconnectedBubbles(tempGrid);
        
        setGrid(result.grid);
        const poppedPoints = matchCluster.length * 10;
        const droppedPoints = result.dropCount * 15;
        setScore(prev => prev + poppedPoints + droppedPoints);

        if (!isMuted) {
          playSound("pop");
          if (result.dropCount > 0) {
            setTimeout(() => playSound("drop"), 100);
          }
        }

        // Check victory (no bubbles left)
        if (Object.keys(result.grid).length === 0) {
          setGameState("victory");
          if (!isMuted) playSound("victory");
        }
      } else {
        // Just stick it in
        setGrid(tempGrid);
        if (!isMuted) playSound("bounce");

        // Check if game over condition triggered (bubbles reached too low)
        if (closestRow >= 11) {
          setGameState("gameover");
          if (!isMuted) playSound("gameover");
        }
      }
    }
  };

  // Handle aiming changes on pointer events
  const updateAimFromPointer = (clientX: number, clientY: number, svgElement: SVGSVGElement) => {
    if (gameState !== "playing" || firedBubble) return;

    const rect = svgElement.getBoundingClientRect();
    
    // Scale client pointer coordinates to internal 320x380 SVG coordinates
    const pointerX = ((clientX - rect.left) / rect.width) * BOARD_WIDTH;
    const pointerY = ((clientY - rect.top) / rect.height) * BOARD_HEIGHT;

    // Calculate angle directly relative to the shooter
    const dy = pointerY - SHOOTER_Y;
    const dx = pointerX - SHOOTER_X;
    
    // We want the angle of the line from (0,0) towards the pointer.
    // If the pointer is below or near the shooter, force a minimum upward angle so they can still aim left/right
    const effectiveDy = dy < -25 ? dy : -25;
    const angle = Math.atan2(effectiveDy, dx);

    // Bound the shooting angle so they cannot shoot too shallow sideways (between -170deg and -10deg)
    const clampedAngle = Math.max(-Math.PI + 0.12, Math.min(-0.12, angle));
    setAimAngle(clampedAngle);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (gameState !== "playing" || firedBubble) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAimFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (gameState !== "playing" || firedBubble) return;
    // Always update the angle when dragging or hovered over the board
    updateAimFromPointer(e.clientX, e.clientY, e.currentTarget);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore
    }

    if (gameState !== "playing" || firedBubble) return;

    // Finalize orientation and shoot the bubble!
    updateAimFromPointer(e.clientX, e.clientY, e.currentTarget);

    const dx = Math.cos(aimAngle) * BUBBLE_SPEED;
    const dy = Math.sin(aimAngle) * BUBBLE_SPEED;

    setFiredBubble({
      x: SHOOTER_X,
      y: SHOOTER_Y,
      colorKey: currentBubble.key,
      colorValue: currentBubble.value,
      dx,
      dy
    });

    if (!isMuted) playSound("shoot");

    // Cycle launcher bubbles
    setCurrentBubble(nextBubble);
    setNextBubble(getRandomColor());
  };

  // Game loop updates for fired bubble physics
  useEffect(() => {
    if (!firedBubble || gameState !== "playing") return;

    const updatePosition = () => {
      setFiredBubble(prev => {
        if (!prev) return null;

        let nextX = prev.x + prev.dx;
        let nextY = prev.y + prev.dy;
        let nextDx = prev.dx;
        let nextDy = prev.dy;

        // Bounce left wall
        if (nextX <= 14) {
          nextX = 14;
          nextDx = -prev.dx;
          if (!isMuted) playSound("bounce");
        }
        // Bounce right wall
        if (nextX >= BOARD_WIDTH - 14) {
          nextX = BOARD_WIDTH - 14;
          nextDx = -prev.dx;
          if (!isMuted) playSound("bounce");
        }

        // Check ceiling crash
        if (nextY <= 14) {
          snapToGrid(nextX, nextY, prev.colorKey, prev.colorValue);
          return null;
        }

        // Check collision with any grid bubble
        for (const [key, bubble] of Object.entries(grid)) {
          const [r, c] = key.split(",").map(Number);
          const gridCoords = getBubbleCoords(r, c);
          const distance = Math.hypot(nextX - gridCoords.x, nextY - gridCoords.y);

          // Radius sum is 28. If close, snap bubble and terminate animation!
          if (distance < 24.5) {
            snapToGrid(nextX, nextY, prev.colorKey, prev.colorValue);
            return null;
          }
        }

        return {
          ...prev,
          x: nextX,
          y: nextY,
          dx: nextDx,
          dy: nextDy
        };
      });

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [firedBubble, grid, gameState]);

  // Generate laser guide pointer dots
  const getAimPoints = () => {
    const points = [];
    let startX = SHOOTER_X;
    let startY = SHOOTER_Y;
    let dx = Math.cos(aimAngle);
    let dy = Math.sin(aimAngle);

    // Track a single clean reflection path
    for (let step = 15; step < 260; step += 15) {
      let px = startX + dx * step;
      let py = startY + dy * step;

      // Handle reflections inside preview laser
      if (px < 14) {
        px = 14 + (14 - px);
      } else if (px > BOARD_WIDTH - 14) {
        px = (BOARD_WIDTH - 14) - (px - (BOARD_WIDTH - 14));
      }

      if (py < 12) break;
      points.push({ x: px, y: py });
    }
    return points;
  };

  const aimPoints = getAimPoints();

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto overflow-hidden bg-[#0c0106]/95 border border-pink-500/35 rounded-2xl p-4 md:p-6 shadow-[0_0_40px_rgba(255,10,84,0.22)] text-slate-100 flex flex-col items-center flex-1 h-full min-h-[480px]">
      
      {/* Laser header metadata details */}
      <div className="w-full flex items-center justify-between border-b border-pink-500/20 pb-2 mb-2 font-mono select-none">
        <div className="flex items-center gap-1.5">
          <Gamepad2 className="w-4 h-4 text-pink-500 animate-pulse" />
          <span className="text-[10px] tracking-wider font-extrabold uppercase text-pink-400">BUBBLE ARCADE 🎮</span>
          
          {toggleVoiceSession && (
            <button
              onClick={toggleVoiceSession}
              className={`ml-2 px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 transition-all border ${
                isVoiceActive 
                  ? "bg-red-500/25 text-red-300 border-red-500/50 animate-pulse" 
                  : "bg-pink-500/15 text-pink-300 border-pink-500/30 hover:bg-pink-500/25"
              }`}
            >
              {isVoiceActive ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
              <span>VOICE: {isVoiceActive ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="text-white/40 hover:text-pink-400 transition-colors cursor-pointer p-0.5"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={initGame} 
            className="text-white/40 hover:text-cyan-400 transition-colors cursor-pointer p-0.5"
            title="Reset Game"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid Stats Display Row */}
      <div className="w-full flex justify-between px-2 mb-3 font-mono select-none">
        <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
          <Award className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] text-slate-400 uppercase">Score:</span>
          <span className="text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-300 font-extrabold">{score}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
          <span className="text-[10px] text-slate-400 uppercase">Classic Pop</span>
          <span className="text-[9px] bg-pink-500/15 text-pink-400 px-1.5 py-0.2 rounded font-black">STABLE</span>
        </div>
      </div>

      {/* Main Shooter Stage Frame */}
      <div className="relative w-full aspect-[320/380] max-h-[580px] bg-[#090004] rounded-xl border border-white/5 overflow-hidden flex-1">
        
        {/* Render background mesh grid overlay for retro look */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        {/* Dynamic game over / win overlay */}
        <AnimatePresence>
          {gameState !== "playing" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/90 flex flex-col justify-center items-center p-4 backdrop-blur-sm select-none"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="text-center space-y-4"
              >
                {gameState === "gameover" ? (
                  <>
                    <h3 className="text-xl font-bold tracking-widest text-[#ff4d6d] font-mono uppercase">Game Over</h3>
                    <p className="text-xs text-white/50 max-w-xs mx-auto font-sans leading-relaxed">
                      Bubbles reached the limit zone. Do not lose courage, Captain! Try again.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center text-yellow-400">
                      <Sparkles className="w-10 h-10 animate-bounce" />
                    </div>
                    <h3 className="text-xl font-bold tracking-widest text-green-400 font-mono uppercase">Victory!</h3>
                    <p className="text-xs text-white/50 max-w-xs mx-auto font-sans leading-relaxed">
                      Amazing skill! You swept the field and achieved total board clearance!
                    </p>
                  </>
                )}

                <div className="text-sm font-mono py-1">
                  Final Score: <span className="text-cyan-400 font-black">{score}</span>
                </div>

                <button
                  onClick={initGame}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-[#de4474] text-white text-xs font-mono uppercase rounded-lg shadow-lg hover:opacity-95 active:scale-95 transition-all cursor-pointer font-bold"
                >
                  Play Again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* High performance SVG board renderer */}
        <svg
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          className="w-full h-full select-none cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        >
          {/* Neon laser guiding dots */}
          {gameState === "playing" && !firedBubble && aimPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2}
              fill="#ff007f"
              className="opacity-60"
              style={{
                filter: "drop-shadow(0 0 3px #ff007f)",
                animation: `pulse 1.2s infinite ease-in-out`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}

          {/* Render Active static grid bubbles */}
          {Object.entries(grid).map(([key, item]) => {
            const bubble = item as GridBubble;
            const [r, c] = key.split(",").map(Number);
            const coords = getBubbleCoords(r, c);
            return (
              <g key={key} className="transition-all duration-300">
                {/* Glow ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={BUBBLE_RADIUS + 2}
                  fill="none"
                  stroke={bubble.colorValue}
                  strokeWidth="0.5"
                  className="opacity-30"
                />
                {/* Main solid bubble */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={BUBBLE_RADIUS}
                  fill={bubble.colorValue}
                  className="filter drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]"
                  style={{
                    filter: `drop-shadow(0 0 6px ${bubble.colorValue}bf)`
                  }}
                />
                {/* Visual gloss shine overlay */}
                <circle
                  cx={coords.x - 4}
                  cy={coords.y - 4}
                  r={3}
                  fill="rgba(255,255,255,0.55)"
                  className="pointer-events-none"
                />
              </g>
            );
          })}

          {/* Render animated fired bubble fly path */}
          {firedBubble && (
            <g>
              <circle
                cx={firedBubble.x}
                cy={firedBubble.y}
                r={BUBBLE_RADIUS}
                fill={firedBubble.colorValue}
                style={{
                  filter: `drop-shadow(0 0 10px ${firedBubble.colorValue})`
                }}
              />
              <circle
                cx={firedBubble.x - 4}
                cy={firedBubble.y - 4}
                r={3}
                fill="rgba(255,255,255,0.6)"
              />
            </g>
          )}

          {/* Launcher Base Rotator */}
          <g transform={`translate(${SHOOTER_X}, ${SHOOTER_Y})`}>
            {/* Shooter outline */}
            <circle cx="0" cy="0" r="18" fill="#15020a" stroke="#ff007f" strokeWidth="1" />
            
            {/* Direct pointing nozzle */}
            <line
              x1="0"
              y1="0"
              x2={Math.cos(aimAngle) * 22}
              y2={Math.sin(aimAngle) * 22}
              stroke="#ff007f"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 4px #ff007f)" }}
            />

            {/* Current Loaded Launching Bubble */}
            <circle
              cx="0"
              cy="0"
              r={11}
              fill={currentBubble.value}
              style={{ filter: `drop-shadow(0 0 8px ${currentBubble.value})` }}
            />
            <circle
              cx="-3"
              cy="-3"
              r="2"
              fill="rgba(255,255,255,0.5)"
            />
          </g>

          {/* Launcher Limit line warnings */}
          <line
            x1="0"
            y1="310"
            x2={BOARD_WIDTH}
            y2="310"
            stroke="rgba(255, 10, 84, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Loaded next upcoming preview bubble */}
        <div className="absolute bottom-3 left-4 flex items-center gap-2 bg-[#1b030f]/80 px-2 py-1 rounded-md border border-pink-500/20 pointer-events-none select-none">
          <span className="text-[8px] font-mono uppercase text-slate-400">Next:</span>
          <div 
            className="w-3.5 h-3.5 rounded-full border border-white/10"
            style={{ 
              backgroundColor: nextBubble.value,
              boxShadow: `0 0 8px ${nextBubble.value}`
            }}
          />
        </div>

        {/* Touch/Hold aim tip text overlay */}
        <div className="absolute bottom-3 right-4 pointer-events-none select-none text-[8px] font-mono text-slate-400 uppercase tracking-wider bg-[#1b030f]/80 px-2 py-1 rounded-md border border-pink-500/10">
          Touch & Drag to Aim
        </div>
      </div>
    </div>
  );
}
