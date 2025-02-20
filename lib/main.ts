const { scene } = spatialDocument;

let playing = false;
let stylusOnVinyl = false;

let musicAudio: HTMLAudioElement;
let playMusic: (volume?: number) => HTMLAudioElement;
let playButtonClickSound: (volume?: number) => HTMLAudioElement;

function pauseMusic() {
  if (musicAudio) {
    musicAudio.pause();
    musicAudio = null;
  }
}

spatialDocument.addEventListener('spaceReady', async () => {
  const model = spatialDocument.getNodeById('model');
  const vinyl = model.getChildren().find(child => child.name === 'model.__root__').getChildren().find(child => child.name === 'model.vinyl');
  const stylus_parts = model.getChildren().find(child => child.name === 'model.__root__').getChildren().find(child => child.name === 'model.record_player').getChildren().find(child => child.name === 'model.stylus_parts');
  // 获取动画组
  const animationGroups = scene.animationGroups;
  const stylusOff_Animation = animationGroups.find(group => group.name === "model.stylus_Off");
  const stylusOn_Animation = animationGroups.find(group => group.name === "model.stylus_On");
  const stylusPlaying_Animation = animationGroups.find(group => group.name === "model.stylus_playing");
  const buttonDown_Animation = animationGroups.find(group => group.name === "model.button_down");
  const buttonUp_Animation = animationGroups.find(group => group.name === "model.button_up");

  // 初始化
  playButtonClickSound = await createAudioPlayer('button-click.wav');
  playMusic = await createAudioPlayer('lofi.mp3');

  // 更新循环
  const update = () => {
    if (playing) {
      rotateVinyl();
    }
    setTimeout(update, 1000 / 60);
  };

  update();

  const rotateVinyl = () => { // 旋转黑胶唱片
    if (vinyl instanceof BABYLON.TransformNode) {
      vinyl.rotate(new BABYLON.Vector3(0, 0, -1), 0.01, BABYLON.Space.LOCAL);
    }
  };



  // 获取按钮
  const buttons = document.querySelectorAll('ref');
  let button_play;

  for (const button of buttons) {
    if (button.id === 'model.pause_play.pause_play') {
      button_play = button;  // 获取按钮_播放&暂停
    }
  }


  if (button_play) { // 监听按钮_播放&暂停
    const mesh_play = button_play.asNativeType() as BABYLON.AbstractMesh;
    mesh_play.isPickable = true;
    mesh_play.outlineColor = new BABYLON.Color3(0, 1, 1);
    mesh_play.overlayColor = new BABYLON.Color3(0, 1, 0);
    const originalMaterial = mesh_play.material;

    button_play.addEventListener('rayenter', () => {
      mesh_play.material = new BABYLON.StandardMaterial("glowMaterial", scene);
      (mesh_play.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(0.9, 1, 1);
      (mesh_play.material as BABYLON.StandardMaterial).disableLighting = true;
      mesh_play.position.x -= 1;
    });

    button_play.addEventListener('rayleave', () => {
      mesh_play.material = originalMaterial; // 恢复原来的材质
    });
    button_play.addEventListener('raydown', () => {
      buttonDown_Animation.start(false);
      playButtonClickSound();
    });

    button_play.addEventListener('rayup', () => {
      buttonUp_Animation.start(false);
      if (playing) {
        playing = false;
        stylusPlaying_Animation.stop();
        stylusOff_Animation.start(false);
        pauseMusic();
      } else {
        stylusOn_Animation.start(false);
        setTimeout(() => {
          playing = true;
          stylusPlaying_Animation.start(true); // 模拟唱针抖动
          musicAudio = playMusic();
        }, 1110);

      }
    });
  }
});

async function createAudioPlayer(name: string) : Promise<(volume?: number) => HTMLAudioElement> {
  const arrayBuffer = await import(`../audio/${name}`);
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
  const objectUrl = URL.createObjectURL(blob);
  return function playAudio(volume?: number) {
    const audio = new Audio(objectUrl);
    if (volume) {
      audio.volume = volume;
    }
    audio.play();
    return audio;
  }
}