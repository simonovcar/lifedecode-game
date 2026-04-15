(() => {
  const rootEl = document.getElementById("game-root");
  const shellEl = document.getElementById("game-shell");

  if (!rootEl || !shellEl) {
    console.log("LifeDecode World: game container not found, skipping init.");
    return;
  }

  if (typeof Phaser === "undefined") {
    console.error("LifeDecode World: Phaser is not loaded.");
    return;
  }

  const GAME_W = 960;
  const GAME_H = 640;
  const ASSET_BASE = "https://cdn.jsdelivr.net/gh/simonovcar/lifedecode-game@main/assets";

  const SCENES = {
    PLAZA: "plaza",
    BREW_INTERIOR: "brew_interior"
  };

  let currentScene = SCENES.PLAZA;
  let sceneRef = null;
  let game = null;

  let bg;
  let playerBody;
  let playerWrap;
  let playerSprite;
  let playerShadow;
  let clickMarker;

  let nameText;
  let bubbleContainer;
  let bubbleBg;
  let bubbleText;

  let target = null;
  let motionTime = 0;
  let baseScale = 0.16;

  let chatToggleBtn = null;
  let chatPanel = null;
  let chatInputEl = null;
  let chatSendBtn = null;
  let chatCloseBtn = null;
  let bubbleHideTimer = null;

  let shopZones = [];
  let activeShopTarget = null;
  let enterModal = null;
  let enterModalTitle = null;
  let enterBtn = null;
  let cancelBtn = null;

  let shopGlow = null;
  let shopGlowTween = null;
  let exitBtn = null;

  // SAFE FX
  let snowDots = [];
  let fountainBase = null;
  let fountainJets = [];
  let fireBase = null;
  let fireFlames = [];

  // WALL BUILD MODE
  let wallGroup = null;
  let buildMode = false;
  let buildInfoText = null;
  let wallPreview = null;
  let wallPreviewStart = null;
  let isDrawingWall = false;
  let wallVisuals = [];

  const wallsByScene = {
    [SCENES.PLAZA]: [],
    [SCENES.BREW_INTERIOR]: []
  };

  function getPlayerName() {
    return (
      localStorage.getItem("ld_user") ||
      localStorage.getItem("lifedecode_user") ||
      "Guest"
    );
  }

  function preload() {
    this.load.image("plaza_bg", `${ASSET_BASE}/bg.png`);
    this.load.image("brew_bg", `${ASSET_BASE}/brew_interior.png`);
    this.load.image("player", `${ASSET_BASE}/player.png`);
  }

  function create() {
    sceneRef = this;

    bg = this.add.image(GAME_W / 2, GAME_H / 2, "plaza_bg");
    fitBackground(bg);

    this.textures.get("plaza_bg").setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get("brew_bg").setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.textures.get("player").setFilter(Phaser.Textures.FilterMode.LINEAR);

    clickMarker = this.add.circle(0, 0, 10, 0xffffff, 0);
    clickMarker.setStrokeStyle(2, 0xffffff, 0.95);
    clickMarker.setVisible(false);
    clickMarker.setDepth(999);

    playerBody = this.add.rectangle(480, 430, 18, 10, 0xffffff, 0);
    this.physics.add.existing(playerBody);

    playerBody.body.setAllowGravity(false);
    playerBody.body.setCollideWorldBounds(true);
    playerBody.body.setVelocity(0, 0);
    playerBody.body.setSize(18, 10);
    playerBody.body.immovable = false;

    playerShadow = this.add.ellipse(0, 0, 24, 8, 0x000000, 0.2);
    playerSprite = this.add.image(0, 0, "player");
    playerSprite.setScale(baseScale);

    playerWrap = this.add.container(playerBody.x, playerBody.y);
    playerWrap.add([playerShadow, playerSprite]);

    nameText = this.add.text(0, -92, getPlayerName(), {
      font: "16px Arial",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5);
    playerWrap.add(nameText);

    bubbleBg = this.add.graphics();
    bubbleText = this.add.text(0, 0, "", {
      font: "16px Arial",
      color: "#222222",
      align: "center",
      wordWrap: { width: 220 }
    }).setOrigin(0.5);

    bubbleContainer = this.add.container(0, -126);
    bubbleContainer.add([bubbleBg, bubbleText]);
    bubbleContainer.setVisible(false);
    playerWrap.add(bubbleContainer);

    shopGlow = this.add.graphics();
    shopGlow.setDepth(15);

    wallGroup = this.physics.add.staticGroup();

    wallPreview = this.add.graphics();
    wallPreview.setDepth(10000);
    wallPreview.setVisible(false);

    buildInfoText = this.add.text(10, 34, "", {
      font: "16px Arial",
      color: "#ffe082",
      stroke: "#000000",
      strokeThickness: 4
    }).setDepth(10001).setVisible(false);

    createShopZones();
    createChatUI();
    createEnterModal();
    createExitButton();

    createSnowFX(this);
    createFountainFX(this);
    createFireFX(this);

    this.add.text(10, 10, "LifeDecode", {
      font: "18px Arial",
      color: "#ffffff"
    }).setDepth(9999);

    createBuildModeKeys(this);

    this.input.on("pointerdown", (pointer) => {
      if (chatInputEl && document.activeElement === chatInputEl) return;
      if (pointer.y > 570) return;

      if (buildMode) {
        startWallPreview(pointer);
        return;
      }

      if (currentScene === SCENES.BREW_INTERIOR) {
        hideEnterModal();
        activeShopTarget = null;
        target = {
          x: Phaser.Math.Clamp(pointer.x, 20, GAME_W - 20),
          y: Phaser.Math.Clamp(pointer.y, 40, GAME_H - 20)
        };
        showClickMarker(this, target.x, target.y);
        return;
      }

      const clickedShop = findClickedShop(pointer.x, pointer.y);

      if (clickedShop) {
        hideEnterModal();
        activeShopTarget = clickedShop;

        target = {
          x: clickedShop.doorX,
          y: clickedShop.doorY
        };

        showClickMarker(this, target.x, target.y);
        pulseShopGlow(this, clickedShop);
        return;
      }

      activeShopTarget = null;
      hideEnterModal();
      clearShopGlow();

      target = {
        x: Phaser.Math.Clamp(pointer.x, 20, GAME_W - 20),
        y: Phaser.Math.Clamp(pointer.y, 40, GAME_H - 20)
      };

      showClickMarker(this, target.x, target.y);
    });

    this.input.on("pointermove", (pointer) => {
      if (!buildMode || !isDrawingWall || !wallPreviewStart) return;
      updateWallPreview(pointer);
    });

    this.input.on("pointerup", (pointer) => {
      if (!buildMode || !isDrawingWall || !wallPreviewStart) return;
      finishWallPreview(pointer);
    });

    this.physics.add.collider(playerBody, wallGroup, () => {
      target = null;
      playerBody.body.setVelocity(0, 0);
    });

    switchScene(SCENES.PLAZA);
    applyResponsiveShell();
  }

  function update(time, delta) {
    if (!playerBody || !playerBody.body) return;

    const maxSpeed = 95;
    const arriveRadius = 6;
    const slowRadius = 90;

    if (target) {
      const dx = target.x - playerBody.x;
      const dy = target.y - playerBody.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= arriveRadius) {
        playerBody.body.setVelocity(0, 0);
        playerBody.x = target.x;
        playerBody.y = target.y;
        target = null;

        if (currentScene === SCENES.PLAZA && activeShopTarget) {
          showEnterModal(activeShopTarget.name);
        }
      } else {
        let speed = maxSpeed;

        if (dist < slowRadius) {
          speed = Phaser.Math.Linear(18, maxSpeed, dist / slowRadius);
        }

        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        playerBody.body.setVelocity(vx, vy);
      }
    } else {
      playerBody.body.setVelocity(0, 0);
    }

    const actualVX = playerBody.body.velocity.x;
    const actualVY = playerBody.body.velocity.y;
    const speedNow = Math.sqrt(actualVX * actualVX + actualVY * actualVY);
    const isMoving = speedNow > 1.5;

    motionTime += delta * (isMoving ? 0.01 : 0.003);

    let bobY = 0;
    let scaleX = baseScale;
    let scaleY = baseScale;
    let angle = 0;

    if (isMoving) {
      bobY = Math.sin(motionTime) * 1.2;
      scaleX = baseScale * (1 + Math.sin(motionTime) * 0.008);
      scaleY = baseScale * (1 - Math.sin(motionTime) * 0.008);
      angle = Math.sin(motionTime) * 1.2;

      if (actualVX < -1) playerSprite.setFlipX(true);
      if (actualVX > 1) playerSprite.setFlipX(false);

      playerShadow.width = 24 + Math.abs(Math.sin(motionTime)) * 4;
      playerShadow.height = 7;
      playerShadow.alpha = 0.16;
    } else {
      playerShadow.width = 24;
      playerShadow.height = 8;
      playerShadow.alpha = 0.2;
    }

    playerWrap.x = playerBody.x;
    playerWrap.y = playerBody.y;

    playerSprite.y = -54 + bobY;
    playerSprite.setScale(scaleX, scaleY);
    playerSprite.setAngle(angle);

    playerShadow.x = 0;
    playerShadow.y = 0;

    bubbleContainer.x = 0;
    bubbleContainer.y = -126;

    playerWrap.setDepth(playerBody.y);

    updateSnowFX();
    updateFountainFX(time);
    updateFireFX(time);
  }

  function fitBackground(image) {
    const scaleX = GAME_W / image.width;
    const scaleY = GAME_H / image.height;
    image.setScale(Math.max(scaleX, scaleY));
  }

  function switchScene(sceneName) {
    currentScene = sceneName;
    target = null;
    activeShopTarget = null;
    hideEnterModal();
    clearShopGlow();

    if (sceneName === SCENES.PLAZA) {
      bg.setTexture("plaza_bg");
      fitBackground(bg);

      playerBody.x = 480;
      playerBody.y = 430;

      showChatButton(true);
      showExitButton(false);

      setSnowVisible(true);
      setFountainVisible(true);
      setFireVisible(true);
    }

    if (sceneName === SCENES.BREW_INTERIOR) {
      bg.setTexture("brew_bg");
      fitBackground(bg);

      playerBody.x = 500;
      playerBody.y = 470;

      showChatButton(true);
      showExitButton(true);

      setSnowVisible(false);
      setFountainVisible(false);
      setFireVisible(false);
    }

    rebuildWallsForCurrentScene();
    refreshWallVisuals();
  }

  function createShopZones() {
    shopZones = [
      {
        name: "Brew Haven",
        x: 36, y: 155, w: 235, h: 95,
        glowX: 150, glowY: 192, glowW: 245, glowH: 120,
        doorX: 160, doorY: 385
      }
    ];
  }

  function findClickedShop(x, y) {
    for (const shop of shopZones) {
      const inside =
        x >= shop.x &&
        x <= shop.x + shop.w &&
        y >= shop.y &&
        y <= shop.y + shop.h;

      if (!inside) continue;

      const cx = shop.x + shop.w / 2;
      const cy = shop.y + shop.h / 2;
      const nx = (x - cx) / (shop.w / 2);
      const ny = (y - cy) / (shop.h / 2);

      if ((nx * nx + ny * ny) <= 1.0) {
        return shop;
      }
    }
    return null;
  }

  function pulseShopGlow(scene, shop) {
    clearShopGlow();

    shopGlow.clear();
    shopGlow.fillStyle(0xffffff, 0.1);
    shopGlow.lineStyle(3, 0xffffff, 0.45);
    shopGlow.fillRoundedRect(
      shop.glowX - shop.glowW / 2,
      shop.glowY - shop.glowH / 2,
      shop.glowW,
      shop.glowH,
      18
    );
    shopGlow.strokeRoundedRect(
      shop.glowX - shop.glowW / 2,
      shop.glowY - shop.glowH / 2,
      shop.glowW,
      shop.glowH,
      18
    );
    shopGlow.setAlpha(0);

    if (shopGlowTween) {
      shopGlowTween.stop();
      shopGlowTween = null;
    }

    shopGlowTween = scene.tweens.add({
      targets: shopGlow,
      alpha: { from: 0, to: 1 },
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeOut"
    });
  }

  function clearShopGlow() {
    if (shopGlowTween) {
      shopGlowTween.stop();
      shopGlowTween = null;
    }
    if (shopGlow) {
      shopGlow.clear();
      shopGlow.setAlpha(1);
    }
  }

  function showClickMarker(scene, x, y) {
    clickMarker.setPosition(x, y);
    clickMarker.setScale(0.5);
    clickMarker.setAlpha(1);
    clickMarker.setVisible(true);

    scene.tweens.killTweensOf(clickMarker);

    scene.tweens.add({
      targets: clickMarker,
      scale: 1.5,
      alpha: 0,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => {
        clickMarker.setVisible(false);
      }
    });
  }

  function createSnowFX(scene) {
    for (let i = 0; i < 55; i++) {
      const dot = scene.add.circle(
        Phaser.Math.Between(0, GAME_W),
        Phaser.Math.Between(0, GAME_H),
        Phaser.Math.FloatBetween(1.2, 2.6),
        0xffffff,
        Phaser.Math.FloatBetween(0.35, 0.95)
      );
      dot.setDepth(50);
      dot.speedY = Phaser.Math.FloatBetween(0.35, 0.9);
      dot.speedX = Phaser.Math.FloatBetween(-0.15, 0.15);
      snowDots.push(dot);
    }
  }

  function updateSnowFX() {
    for (const dot of snowDots) {
      if (!dot.visible) continue;

      dot.y += dot.speedY;
      dot.x += dot.speedX;

      if (dot.y > GAME_H + 5) {
        dot.y = -5;
        dot.x = Phaser.Math.Between(0, GAME_W);
      }

      if (dot.x < -5) dot.x = GAME_W + 5;
      if (dot.x > GAME_W + 5) dot.x = -5;
    }
  }

  function setSnowVisible(visible) {
    for (const dot of snowDots) {
      dot.setVisible(visible);
    }
  }

  function createFountainFX(scene) {
    const fx = 668;
    const fy = 330;

    fountainBase = scene.add.graphics();
    fountainBase.setDepth(20);

    for (let i = 0; i < 5; i++) {
      const jet = scene.add.circle(
        fx + (i - 2) * 8,
        fy,
        Phaser.Math.Between(2, 4),
        0x8fefff,
        0.8
      );
      jet.setDepth(21);
      jet.baseX = jet.x;
      jet.baseY = fy;
      jet.offset = i * 0.5;
      fountainJets.push(jet);
    }
  }

  function updateFountainFX(time) {
    if (!fountainBase || !fountainBase.visible) return;

    const fx = 668;
    const fy = 330;

    fountainBase.clear();
    fountainBase.fillStyle(0x7ee7ff, 0.2 + Math.sin(time * 0.004) * 0.05);
    fountainBase.lineStyle(2, 0xbef8ff, 0.35);
    fountainBase.fillEllipse(fx, fy + 8, 110, 34);
    fountainBase.strokeEllipse(fx, fy + 8, 110, 34);

    for (let i = 0; i < fountainJets.length; i++) {
      const jet = fountainJets[i];
      const t = time * 0.006 + jet.offset;

      jet.x = jet.baseX + Math.sin(t * 1.3) * 3;
      jet.y = jet.baseY - Math.abs(Math.sin(t)) * 26;
      jet.alpha = 0.45 + Math.abs(Math.sin(t)) * 0.35;
      jet.radius = 2 + Math.abs(Math.sin(t)) * 2;
    }
  }

  function setFountainVisible(visible) {
    if (fountainBase) fountainBase.setVisible(visible);
    for (const jet of fountainJets) jet.setVisible(visible);
  }

  function createFireFX(scene) {
    const fx = 365;
    const fy = 425;

    fireBase = scene.add.graphics();
    fireBase.setDepth(18);

    for (let i = 0; i < 4; i++) {
      const flame = scene.add.ellipse(
        fx,
        fy,
        10,
        20,
        0xff9e2c,
        0.8
      );
      flame.setDepth(19 + i);
      flame.offset = i * 0.7;
      fireFlames.push(flame);
    }
  }

  function updateFireFX(time) {
    if (!fireBase || !fireBase.visible) return;

    const fx = 365;
    const fy = 425;

    fireBase.clear();
    fireBase.fillStyle(0xffb347, 0.15 + Math.sin(time * 0.02) * 0.03);
    fireBase.fillEllipse(fx, fy + 12, 72, 24);

    for (let i = 0; i < fireFlames.length; i++) {
      const flame = fireFlames[i];
      const t = time * 0.012 + flame.offset;
      const amp = 4 + i * 2;

      flame.x = fx + Math.sin(t * 1.8) * (2 + i);
      flame.y = fy - 10 - Math.abs(Math.sin(t)) * amp;
      flame.width = 12 + Math.abs(Math.sin(t * 1.4)) * 8;
      flame.height = 18 + Math.abs(Math.sin(t * 1.8)) * 16;
      flame.alpha = 0.45 + Math.abs(Math.sin(t)) * 0.45;

      if (i === 0) flame.fillColor = 0xfff0a0;
      if (i === 1) flame.fillColor = 0xffc04d;
      if (i === 2) flame.fillColor = 0xff8a1f;
      if (i === 3) flame.fillColor = 0xff5a00;
    }
  }

  function setFireVisible(visible) {
    if (fireBase) fireBase.setVisible(visible);
    for (const flame of fireFlames) flame.setVisible(visible);
  }

  function createBuildModeKeys(scene) {
    scene.input.keyboard.on("keydown-B", () => {
      buildMode = !buildMode;
      isDrawingWall = false;
      wallPreviewStart = null;
      wallPreview.clear();
      wallPreview.setVisible(false);
      refreshWallVisuals();
      updateBuildInfo();
    });

    scene.input.keyboard.on("keydown-DELETE", () => {
      if (!buildMode) return;
      deleteLastWallInCurrentScene();
    });

    scene.input.keyboard.on("keydown-BACKSPACE", () => {
      if (!buildMode) return;
      deleteLastWallInCurrentScene();
    });

    scene.input.keyboard.on("keydown-P", () => {
      console.log("Walls for scene:", currentScene);
      console.log(JSON.stringify(wallsByScene[currentScene], null, 2));
    });
  }

  function updateBuildInfo() {
    if (!buildInfoText) return;

    if (!buildMode) {
      buildInfoText.setVisible(false);
      return;
    }

    buildInfoText.setText(
      "BUILD MODE ON  |  Drag = new wall  |  Delete = remove last  |  P = print walls"
    );
    buildInfoText.setVisible(true);
  }

  function startWallPreview(pointer) {
    wallPreviewStart = {
      x: Phaser.Math.Clamp(pointer.x, 0, GAME_W),
      y: Phaser.Math.Clamp(pointer.y, 0, GAME_H)
    };
    isDrawingWall = true;
    wallPreview.setVisible(true);
    drawWallPreview(wallPreviewStart.x, wallPreviewStart.y, 1, 1);
  }

  function updateWallPreview(pointer) {
    const start = wallPreviewStart;
    const endX = Phaser.Math.Clamp(pointer.x, 0, GAME_W);
    const endY = Phaser.Math.Clamp(pointer.y, 0, GAME_H);

    const rect = normalizeRect(start.x, start.y, endX, endY);
    drawWallPreview(rect.x, rect.y, rect.w, rect.h);
  }

  function finishWallPreview(pointer) {
    const start = wallPreviewStart;
    const endX = Phaser.Math.Clamp(pointer.x, 0, GAME_W);
    const endY = Phaser.Math.Clamp(pointer.y, 0, GAME_H);

    const rect = normalizeRect(start.x, start.y, endX, endY);

    wallPreview.clear();
    wallPreview.setVisible(false);
    wallPreviewStart = null;
    isDrawingWall = false;

    if (rect.w < 8 || rect.h < 8) return;

    addWallToCurrentScene(rect.x, rect.y, rect.w, rect.h);
  }

  function drawWallPreview(x, y, w, h) {
    wallPreview.clear();
    wallPreview.lineStyle(2, 0x00ffcc, 0.95);
    wallPreview.fillStyle(0x00ffcc, 0.16);
    wallPreview.fillRect(x, y, w, h);
    wallPreview.strokeRect(x, y, w, h);
  }

  function normalizeRect(x1, y1, x2, y2) {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    return { x, y, w, h };
  }

  function addWallToCurrentScene(x, y, w, h) {
    wallsByScene[currentScene].push({ x, y, w, h });
    rebuildWallsForCurrentScene();
    refreshWallVisuals();
    console.log("Added wall:", { scene: currentScene, x, y, w, h });
  }

  function deleteLastWallInCurrentScene() {
    if (!wallsByScene[currentScene].length) return;
    wallsByScene[currentScene].pop();
    rebuildWallsForCurrentScene();
    refreshWallVisuals();
    console.log("Removed last wall from scene:", currentScene);
  }

  function rebuildWallsForCurrentScene() {
    if (!sceneRef || !wallGroup) return;

    wallGroup.clear(true, true);

    for (const g of wallVisuals) g.destroy();
    wallVisuals = [];

    const sceneWalls = wallsByScene[currentScene];

    for (const wall of sceneWalls) {
      const cx = wall.x + wall.w / 2;
      const cy = wall.y + wall.h / 2;

      const rect = sceneRef.add.rectangle(cx, cy, wall.w, wall.h, 0xffffff, 0);
      sceneRef.physics.add.existing(rect, true);
      wallGroup.add(rect);

      const outline = sceneRef.add.graphics();
      outline.setDepth(10002);
      wallVisuals.push(outline);
    }
  }

  function refreshWallVisuals() {
    const sceneWalls = wallsByScene[currentScene];

    for (let i = 0; i < wallVisuals.length; i++) {
      const g = wallVisuals[i];
      const wall = sceneWalls[i];
      if (!g || !wall) continue;

      g.clear();

      if (!buildMode) {
        g.setVisible(false);
        continue;
      }

      g.setVisible(true);
      g.lineStyle(2, 0x00ffcc, 0.95);
      g.fillStyle(0x00ffcc, 0.16);
      g.fillRect(wall.x, wall.y, wall.w, wall.h);
      g.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }

    updateBuildInfo();
  }

  function createChatUI() {
    const shell = document.getElementById("game-shell");
    if (!shell) return;

    chatToggleBtn = document.createElement("button");
    chatToggleBtn.textContent = "Chat";
    Object.assign(chatToggleBtn.style, {
      position: "absolute",
      left: "50%",
      bottom: "14px",
      transform: "translateX(-50%)",
      padding: "12px 22px",
      borderRadius: "18px",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "16px",
      fontWeight: "600",
      cursor: "pointer",
      zIndex: "50",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
    });
    shell.appendChild(chatToggleBtn);

    chatPanel = document.createElement("div");
    Object.assign(chatPanel.style, {
      position: "absolute",
      left: "50%",
      bottom: "14px",
      transform: "translateX(-50%)",
      display: "none",
      alignItems: "center",
      gap: "10px",
      zIndex: "51",
      width: "calc(100% - 20px)",
      maxWidth: "520px",
      justifyContent: "center"
    });
    shell.appendChild(chatPanel);

    chatInputEl = document.createElement("input");
    chatInputEl.type = "text";
    chatInputEl.placeholder = "Type a message...";
    chatInputEl.maxLength = 80;
    Object.assign(chatInputEl.style, {
      flex: "1 1 auto",
      minWidth: "0",
      width: "320px",
      padding: "12px 14px",
      borderRadius: "18px",
      border: "2px solid #d9d9d9",
      outline: "none",
      fontSize: "16px",
      background: "rgba(255,255,255,0.98)",
      color: "#222",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
    });

    chatSendBtn = document.createElement("button");
    chatSendBtn.textContent = "Send";
    Object.assign(chatSendBtn.style, {
      padding: "12px 16px",
      borderRadius: "16px",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
    });

    chatCloseBtn = document.createElement("button");
    chatCloseBtn.textContent = "X";
    Object.assign(chatCloseBtn.style, {
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
      flex: "0 0 42px"
    });

    chatPanel.appendChild(chatInputEl);
    chatPanel.appendChild(chatSendBtn);
    chatPanel.appendChild(chatCloseBtn);

    chatToggleBtn.addEventListener("click", () => {
      hideEnterModal();
      chatToggleBtn.style.display = "none";
      chatPanel.style.display = "flex";
      chatInputEl.focus();
    });

    chatCloseBtn.addEventListener("click", closeChat);
    chatSendBtn.addEventListener("click", submitChat);

    chatInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        submitChat();
      } else if (e.key === "Escape") {
        closeChat();
      }
    });

    syncMobileUI();
    window.addEventListener("resize", syncMobileUI);
  }

  function syncMobileUI() {
    const isMobile = window.innerWidth <= 767;

    if (chatToggleBtn) {
      chatToggleBtn.style.fontSize = isMobile ? "14px" : "16px";
      chatToggleBtn.style.padding = isMobile ? "10px 18px" : "12px 22px";
      chatToggleBtn.style.bottom = isMobile ? "10px" : "14px";
    }

    if (chatPanel) {
      chatPanel.style.bottom = isMobile ? "10px" : "14px";
      chatPanel.style.gap = isMobile ? "8px" : "10px";
      chatPanel.style.maxWidth = isMobile ? "calc(100% - 16px)" : "520px";
    }

    if (chatInputEl) {
      chatInputEl.style.fontSize = isMobile ? "14px" : "16px";
      chatInputEl.style.padding = isMobile ? "10px 12px" : "12px 14px";
    }

    if (chatSendBtn) {
      chatSendBtn.style.fontSize = isMobile ? "14px" : "15px";
      chatSendBtn.style.padding = isMobile ? "10px 14px" : "12px 16px";
    }

    if (chatCloseBtn) {
      const size = isMobile ? 38 : 42;
      chatCloseBtn.style.width = `${size}px`;
      chatCloseBtn.style.height = `${size}px`;
      chatCloseBtn.style.flex = `0 0 ${size}px`;
    }

    if (exitBtn) {
      exitBtn.style.bottom = isMobile ? "10px" : "14px";
      exitBtn.style.right = isMobile ? "10px" : "16px";
      exitBtn.style.fontSize = isMobile ? "14px" : "16px";
      exitBtn.style.padding = isMobile ? "10px 16px" : "12px 20px";
    }

    if (enterModal) {
      enterModal.style.width = isMobile ? "calc(100% - 24px)" : "auto";
      enterModal.style.minWidth = isMobile ? "0" : "260px";
      enterModal.style.maxWidth = isMobile ? "360px" : "none";
      enterModal.style.padding = isMobile ? "16px" : "20px";
    }
  }

  function showChatButton(show) {
    if (!chatToggleBtn || !chatPanel) return;
    if (!show) {
      chatToggleBtn.style.display = "none";
      chatPanel.style.display = "none";
      return;
    }
    if (chatPanel.style.display !== "flex") {
      chatToggleBtn.style.display = "block";
    }
  }

  function closeChat() {
    if (!chatPanel || !chatToggleBtn || !chatInputEl) return;
    chatPanel.style.display = "none";
    chatToggleBtn.style.display = "block";
    chatInputEl.value = "";
    chatInputEl.blur();
  }

  function submitChat() {
    if (!chatInputEl) return;

    const msg = chatInputEl.value.trim();
    if (!msg) {
      closeChat();
      return;
    }

    showBubble(msg);
    closeChat();
  }

  function showBubble(message) {
    bubbleText.setText(message);

    const paddingX = 16;
    const paddingY = 12;
    const w = Math.max(90, bubbleText.width + paddingX * 2);
    const h = Math.max(42, bubbleText.height + paddingY * 2);

    bubbleBg.clear();
    bubbleBg.fillStyle(0xffffff, 0.96);
    bubbleBg.lineStyle(2, 0xdcdcdc, 1);

    bubbleBg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bubbleBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    bubbleBg.fillTriangle(-8, h / 2 - 2, 8, h / 2 - 2, 0, h / 2 + 12);
    bubbleBg.lineBetween(-8, h / 2 - 2, 0, h / 2 + 12);
    bubbleBg.lineBetween(8, h / 2 - 2, 0, h / 2 + 12);

    bubbleText.setPosition(0, 0);
    bubbleContainer.setVisible(true);
    bubbleContainer.setAlpha(1);
    bubbleContainer.y = -126;

    if (bubbleHideTimer) clearTimeout(bubbleHideTimer);

    bubbleHideTimer = setTimeout(() => {
      if (!bubbleContainer || !bubbleContainer.scene) return;

      bubbleContainer.scene.tweens.add({
        targets: bubbleContainer,
        alpha: 0,
        y: -134,
        duration: 220,
        ease: "Quad.easeIn",
        onComplete: () => {
          bubbleContainer.setVisible(false);
          bubbleContainer.setAlpha(1);
          bubbleContainer.y = -126;
        }
      });
    }, 3500);
  }

  function createEnterModal() {
    const shell = document.getElementById("game-shell");
    if (!shell) return;

    enterModal = document.createElement("div");
    Object.assign(enterModal.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      gap: "14px",
      padding: "20px",
      borderRadius: "20px",
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      zIndex: "60",
      minWidth: "260px"
    });

    enterModalTitle = document.createElement("div");
    enterModalTitle.textContent = "Enter shop?";
    Object.assign(enterModalTitle.style, {
      fontSize: "20px",
      fontWeight: "700",
      color: "#222",
      textAlign: "center"
    });

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      gap: "12px"
    });

    enterBtn = document.createElement("button");
    enterBtn.textContent = "Enter";
    Object.assign(enterBtn.style, {
      padding: "12px 18px",
      borderRadius: "14px",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(0,0,0,0.18)"
    });

    cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    Object.assign(cancelBtn.style, {
      padding: "12px 18px",
      borderRadius: "14px",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(0,0,0,0.18)"
    });

    row.appendChild(enterBtn);
    row.appendChild(cancelBtn);

    enterModal.appendChild(enterModalTitle);
    enterModal.appendChild(row);
    shell.appendChild(enterModal);

    enterBtn.addEventListener("click", () => {
      if (!activeShopTarget) return;

      if (activeShopTarget.name === "Brew Haven") {
        switchScene(SCENES.BREW_INTERIOR);
      } else {
        showBubble(`Entering ${activeShopTarget.name}...`);
      }

      hideEnterModal();
    });

    cancelBtn.addEventListener("click", () => {
      activeShopTarget = null;
      hideEnterModal();
      clearShopGlow();
    });

    syncMobileUI();
  }

  function showEnterModal(shopName) {
    if (chatPanel && chatPanel.style.display === "flex") return;
    if (!enterModal) return;

    enterModalTitle.textContent = `Enter ${shopName}?`;
    enterModal.style.display = "flex";
  }

  function hideEnterModal() {
    if (!enterModal) return;
    enterModal.style.display = "none";
  }

  function createExitButton() {
    const shell = document.getElementById("game-shell");
    if (!shell) return;

    exitBtn = document.createElement("button");
    exitBtn.textContent = "Exit";
    Object.assign(exitBtn.style, {
      position: "absolute",
      right: "16px",
      bottom: "14px",
      padding: "12px 20px",
      borderRadius: "18px",
      border: "none",
      background: "#ffffff",
      color: "#222",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      zIndex: "55",
      display: "none",
      boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
    });

    shell.appendChild(exitBtn);
    exitBtn.addEventListener("click", () => switchScene(SCENES.PLAZA));
    syncMobileUI();
  }

  function showExitButton(show) {
    if (!exitBtn) return;
    exitBtn.style.display = show ? "block" : "none";
  }

  function applyResponsiveShell() {
    Object.assign(shellEl.style, {
      position: "relative",
      width: "min(960px, 100%)",
      aspectRatio: "960 / 640",
      height: "auto",
      margin: "20px auto",
      overflow: "hidden",
      borderRadius: window.innerWidth <= 767 ? "0" : "12px",
      boxShadow: window.innerWidth <= 767 ? "none" : "0 10px 30px rgba(0,0,0,0.25)",
      background: "#000"
    });

    if (window.innerWidth <= 767) {
      shellEl.style.margin = "0 auto";
    }

    Object.assign(rootEl.style, {
      width: "100%",
      height: "100%"
    });
  }

  const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: "game-root",
    pixelArt: false,
    antialias: true,
    backgroundColor: "#000000",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_W,
      height: GAME_H
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    scene: {
      preload,
      create,
      update
    }
  };

  game = new Phaser.Game(config);

  window.addEventListener("resize", () => {
    applyResponsiveShell();
    syncMobileUI();
  });
})();
