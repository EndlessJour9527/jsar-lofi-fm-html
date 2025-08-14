import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Lofi FM 主初始化函数
 */
function init() {
  // ==================== 工具函数 ====================

  /**
   * 解析URL参数
   * @returns {Object} 参数对象
   */
  function parseUrlParams() {
    const params = {};
    const search = window.location.search.slice(1);
    if (search) {
      search.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        try {
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        } catch (e) {
          console.warn('Failed to decode param:', key, value);
        }
      });
    }
    return params;
  }

  /**
   * 初始化Three.js场景
   * @returns {Object} 包含scene和camera的对象
   */
  function initScene() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1.0, 0.1, 1000);

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 添加点光源增加模型亮度
    const pointLight = new THREE.PointLight(0xffffff, 40, 10);
    pointLight.position.set(0, 2, 2);
    pointLight.name = 'modelPointLight';
    scene.add(pointLight);
    console.log('添加点光源增强模型照明');

    return { scene, camera };
  }

  // ==================== 音频系统 ====================

  /**
   * 创建音频播放器（单例模式）
   * @param {string} audioPath 音频文件路径
   * @returns {Promise<Function>} 返回播放函数
   */
  async function createAudioPlayer(audioPath) {
    return function playAudio(volume = 1.0) {
      try {
        if (audioPath.includes('lofi.mp3')) {
          // 音乐文件使用单例模式
          if (!audioState.musicAudio) {
            // 只在第一次创建音频实例
            audioState.musicAudio = new Audio(audioPath);
            audioState.musicAudio.loop = true;
            console.log('创建音乐音频实例');
          }

          // 设置音量并播放
          audioState.musicAudio.volume = volume;
          audioState.musicAudio.currentTime = 0; // 从头开始播放
          const playPromise = audioState.musicAudio.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(err => console.warn('Audio play failed:', err));
          }
          return audioState.musicAudio;
        } else {
          // 音效文件每次创建新实例（短音效不需要单例）
          const audio = new Audio(audioPath);
          audio.volume = volume;
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(err => console.warn('Audio play failed:', err));
          }
          return audio;
        }
      } catch (error) {
        console.warn('Audio creation failed:', error);
        // 返回一个空的音频对象，避免返回 null
        return {
          play: () => Promise.resolve(),
          pause: () => { },
          volume: 0,
          currentTime: 0
        };
      }
    };
  }

  /**
   * 暂停音乐
   */
  function pauseMusic() {
    if (audioState.musicAudio) {
      console.log('暂停音频播放');
      audioState.musicAudio.pause();
      audioState.musicAudio.currentTime = 0; // 重置播放位置
    } else {
      console.log('没有音频实例需要暂停');
    }
  }

  /**
   * 清理音频实例（用于切换音轨）
   */
  function cleanupAudio() {
    if (audioState.musicAudio) {
      console.log('清理音频实例');
      audioState.musicAudio.pause();
      audioState.musicAudio = null;
    }
  }

  // ==================== 模型加载 ====================

  /**
   * 加载GLTF模型
   * @param {string} url 模型URL
   * @param {Function} onLoaded 加载完成回调
   */
  function loadModel(url, onLoaded) {
    if (!url) {
      console.error('模型URL为空');
      if (onLoaded) onLoaded(new Error('模型URL为空'));
      return;
    }

    console.log('开始加载Lofi FM模型:', url);
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        console.log('Lofi FM模型加载成功');
        processLoadedModel(gltf);
        updateStatus('3D模型加载完成！');
        if (onLoaded) onLoaded();
      },
      (progress) => {
        const percent = Math.round((progress.loaded / progress.total * 100));
        updateStatus(`正在加载3D模型... ${percent}%`);
        console.log('加载进度:', percent + '%');
      },
      (error) => {
        console.error('模型加载失败:', error);
        updateStatus('模型加载失败: ' + error.message);
        if (onLoaded) onLoaded(error);
      }
    );
  }

  /**
   * 处理已加载的模型
   * @param {Object} gltf GLTF对象
   */
  function processLoadedModel(gltf) {
    const parentGroup = new THREE.Group();
    const model = gltf.scene;

    console.log('GLTF对象:', gltf);
    console.log('GLTF动画数量:', gltf.animations ? gltf.animations.length : 0);
    if (gltf.animations) {
      gltf.animations.forEach((anim, index) => {
        console.log(`动画 ${index}:`, anim.name, '时长:', anim.duration, '轨道数:', anim.tracks.length);
      });
    }

    // 查找关键组件
    findModelComponents(model);

    // 设置模型网格的射线投射（按钮保持检测，其他部分用于旋转交互）
    model.traverse((node) => {
      console.log('遍历模型节点:', node.name, '类型:', node.type);
      if (node.isMesh) {
        if (node.name.includes('pause_play')) {
          // 按钮保持射线检测
          console.log('保留按钮射线检测:', node.name);
        } else {
          // 其他部分保持射线检测用于旋转交互，但标记为非按钮
          node.userData.isRotatable = true;
          console.log('设置为可旋转区域:', node.name);
        }
      }
    });

    console.log('模型子对象数量:', model.children.length);

    parentGroup.add(model);
    parentGroup.name = 'lofi-fm-container';

    // 处理动画
    setupModelAnimations(gltf, model);

    // 处理模型尺寸和位置
    setupModelTransform(model, parentGroup);

    // 设置交互
    setupInteractions(model);

    // 添加到场景
    group.add(parentGroup);
  }

  /**
   * 查找模型组件
   * @param {THREE.Object3D} model 模型对象
   */
  function findModelComponents(model) {
    model.traverse((child) => {
      if (child.name.includes('vinyl')) {
        modelComponents.vinyl = child;
        console.log('找到黑胶唱片:', child.name);
      }
      if (child.name.includes('pause_play')) {
        modelComponents.playButton = child;
        console.log('找到播放按钮:', child.name);
      }
      if (child.name.includes('stylus')) {
        modelComponents.stylus = child;
        console.log('找到唱针:', child.name);
      }
    });
  }

  /**
   * 设置模型动画
   * @param {Object} gltf GLTF对象
   * @param {THREE.Object3D} model 模型对象
   */
  function setupModelAnimations(gltf, model) {
    if (gltf.animations && gltf.animations.length > 0) {
      animationControl.mixer = new THREE.AnimationMixer(model);

      // 创建动画映射
      gltf.animations.forEach(anim => {
        const action = animationControl.mixer.clipAction(anim);
        animationControl.animations[anim.name] = {
          action: action,
          duration: anim.duration
        };
        console.log('注册动画:', anim.name, '时长:', anim.duration);
      });

      console.log('模型动画设置完成，动画数量:', gltf.animations.length);
      console.log('可用动画列表:', Object.keys(animationControl.animations));
    } else {
      console.warn('模型中没有找到动画数据');
    }
  }

  /**
   * 设置模型变换（位置、缩放等）
   * @param {THREE.Object3D} model 模型对象
   * @param {THREE.Group} parentGroup 父组
   */
  function setupModelTransform(model, parentGroup) {
    // 计算包围盒
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // 模型居中
    model.position.sub(center);

    // 计算缩放因子
    const scaleFactor = 1.0 / (Math.max(size.x, size.y, size.z) * 3);
    parentGroup.scale.setScalar(scaleFactor);
    parentGroup.position.set(0, 0.01, 0);

    console.log('Lofi FM模型尺寸设置完成，缩放因子:', scaleFactor);
  }

  /**
   * 设置交互
   * @param {THREE.Object3D} model 模型对象
   */
  function setupInteractions(model) {
    if (modelComponents.playButton) {
      // 直接设置按钮为可点击
      modelComponents.playButton.userData.isButton = true;
      modelComponents.playButton.userData.clickable = true;
      modelComponents.playButton.userData.buttonType = 'play';

      // 保存原始材质
      if (modelComponents.playButton.material) {
        modelComponents.originalMaterial = modelComponents.playButton.material.clone();
        console.log('保存按钮原始材质');
      }

      // 确保按钮可以被射线检测
      modelComponents.playButton.raycast = THREE.Mesh.prototype.raycast;

      console.log('播放按钮交互设置完成');
      console.log('按钮名称:', modelComponents.playButton.name);
      console.log('按钮位置:', modelComponents.playButton.position);
      console.log('按钮用户数据:', modelComponents.playButton.userData);
    } else {
      console.warn('未找到播放按钮，无法设置交互');
    }

    // 查找并设置其他按钮（上一首、下一首）
    model.traverse((child) => {
      if (child.name.includes('prev') || child.name.includes('previous')) {
        child.userData.isButton = true;
        child.userData.buttonType = 'prev';
        child.raycast = THREE.Mesh.prototype.raycast;
        console.log('找到上一首按钮:', child.name);
      }
      if (child.name.includes('next')) {
        child.userData.isButton = true;
        child.userData.buttonType = 'next';
        child.raycast = THREE.Mesh.prototype.raycast;
        console.log('找到下一首按钮:', child.name);
      }
    });
  }

  // ==================== 游戏逻辑 ====================

  /**
   * 旋转黑胶唱片
   */
  function rotateVinyl() {
    if (modelComponents.vinyl && gameState.playing) {
      modelComponents.vinyl.rotation.z -= 0.01;
    }
  }

  /**
   * 播放动画
   * @param {string} animationName 动画名称
   * @param {boolean} loop 是否循环
   */
  function playAnimation(animationName, loop = false) {
    const anim = animationControl.animations[animationName];
    console.log('播放动画:', animationName, '循环:', loop);
    if (anim) {
      anim.action.reset();
      anim.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
      anim.action.clampWhenFinished = !loop;
      anim.action.play();
      console.log('播放动画:', animationName);
    } else {
      console.warn('动画不存在:', animationName, '可用动画:', Object.keys(animationControl.animations));
    }
  }

  /**
   * 停止动画
   * @param {string} animationName 动画名称
   */
  function stopAnimation(animationName) {
    const anim = animationControl.animations[animationName];
    if (anim) {
      anim.action.stop();
      console.log('停止动画:', animationName);
    } else {
      console.warn('要停止的动画不存在:', animationName);
    }
  }

  /**
   * 更新按钮状态视觉效果
   * @param {string} state - 状态类型: 'hover', 'pressed', 'playing', 'idle'
   */
  function updateButtonStateVisual(state = null) {
    if (!modelComponents.playButton || !modelComponents.originalMaterial) {
      return;
    }

    // 根据优先级确定状态: pressed > playing > hover > idle
    let currentState = state;
    if (!currentState) {
      if (xrControl.buttonPressed) {
        currentState = 'pressed';
      } else if (gameState.playing) {
        currentState = 'playing';
      } else if (xrControl.isHovering) {
        currentState = 'hover';
      } else {
        currentState = 'idle';
      }
    }

    const material = modelComponents.originalMaterial.clone();

    switch (currentState) {
      case 'hover':
        material.emissive.setRGB(0.9, 1, 1); // 悬停时青色
        material.emissiveIntensity = 0.3;
        console.log('更新为悬停状态视觉');
        break;
      case 'pressed':
        material.emissive.setRGB(1, 0.8, 0.2); // 按下时橙色
        material.emissiveIntensity = 0.4;
        console.log('更新为按下状态视觉');
        break;
      case 'playing':
        material.emissive.setHex(0x004400); // 播放时淡绿色
        material.emissiveIntensity = 0.2;
        console.log('更新为播放状态视觉');
        break;
      case 'idle':
      default:
        modelComponents.playButton.material = modelComponents.originalMaterial;
        console.log('更新为空闲状态视觉');
        return;
    }

    modelComponents.playButton.material = material;
  }

  /**
   * 切换播放状态
   */
  function togglePlayback(onAnimaCompelted) {
    if (gameState.playing) {
      // 停止播放序列
      gameState.playing = false;
      console.log('开始停止音乐序列');

      // 停止当前播放的动画
      ['stylus_On', 'stylus_playing'].forEach(animName => {
        if (animationControl.animations[animName]) {
          animationControl.animations[animName].action.stop();
          console.log('停止动画:', animName);
        }
      });

      // 暂停音乐
      pauseMusic();
      onAnimaCompelted();

      // 播放 stylus_Off 动画
      if (animationControl.animations['stylus_Off']) {
        playAnimation('stylus_Off');
        console.log('播放 stylus_Off 动画');

        // 等待 stylus_Off 完成
        const stylusOffDuration = animationControl.animations['stylus_Off'].duration * 1000;
        setTimeout(() => {
          stopAnimation('stylus_Off');
          console.log('音乐序列停止完成');
          updateButtonStateVisual();
        }, stylusOffDuration);
      } else {
        console.log('警告: stylus_Off 动画不存在，序列停止完成');
        updateButtonStateVisual();
      }
    } else {
      // 开始播放序列
      console.log('开始播放音乐序列');

      // 1. 播放 stylus_On
      if (animationControl.animations['stylus_On']) {
        playAnimation('stylus_On');
        console.log('步骤1: 播放 stylus_On 动画');

        // 2. 等待 stylus_On 完成后播放 stylus_playing
        const stylusOnDuration = animationControl.animations['stylus_On'].duration * 1000;
        setTimeout(() => {
          gameState.playing = true;

          if (animationControl.animations['stylus_playing']) {
            // 循环播放 stylus_playing
            playAnimation('stylus_playing', true);
            console.log('步骤2: 开始循环播放 stylus_playing 动画');
          }

          // 开始播放音乐
          if (audioState.playMusic && typeof audioState.playMusic === 'function') {
            audioState.playMusic();
            onAnimaCompelted();
            console.log('音乐开始播放');
          } else {
            console.error('音频播放函数未初始化');
          }

          updateButtonStateVisual();
        }, stylusOnDuration);
      } else {
        console.log('警告: stylus_On 动画不存在，使用简化播放序列');
        gameState.playing = true;
        if (animationControl.animations['stylus_playing']) {
          playAnimation('stylus_playing', true);
        }
        if (audioState.playMusic && typeof audioState.playMusic === 'function') {
          audioState.playMusic();
        }
        updateButtonStateVisual();
      }
    }
  }

  /**
   * 播放上一首
   */
  function playPreviousTrack() {
    if (audioState.trackList.length <= 1) {
      console.log('只有一首歌曲，无法切换到上一首');
      return;
    }

    audioState.currentTrackIndex = (audioState.currentTrackIndex - 1 + audioState.trackList.length) % audioState.trackList.length;
    const currentTrack = audioState.trackList[audioState.currentTrackIndex];
    console.log('切换到上一首:', currentTrack.name);

    // 如果正在播放，先暂停再切换
    if (gameState.playing) {
      cleanupAudio(); // 清理当前音频实例
      // 重新初始化音频并播放
      setTimeout(() => {
        initAudio().then(() => {
          if (audioState.playMusic) {
            // playMusic函数内部会创建新的音频实例
            audioState.playMusic();
          }
        });
      }, 100);
    } else {
      // 即使不在播放也要清理音频实例，为下次播放准备
      cleanupAudio();
    }

    updateStatus(`正在播放: ${currentTrack.name}`);
  }

  /**
   * 播放下一首
   */
  function playNextTrack() {
    if (audioState.trackList.length <= 1) {
      console.log('只有一首歌曲，无法切换到下一首');
      return;
    }

    audioState.currentTrackIndex = (audioState.currentTrackIndex + 1) % audioState.trackList.length;
    const currentTrack = audioState.trackList[audioState.currentTrackIndex];
    console.log('切换到下一首:', currentTrack.name);

    // 如果正在播放，先暂停再切换
    if (gameState.playing) {
      cleanupAudio(); // 清理当前音频实例
      // 重新初始化音频并播放
      setTimeout(() => {
        initAudio().then(() => {
          if (audioState.playMusic) {
            // playMusic函数内部会创建新的音频实例
            audioState.playMusic();
          }
        });
      }, 100);
    } else {
      // 即使不在播放也要清理音频实例，为下次播放准备
      cleanupAudio();
    }

    updateStatus(`正在播放: ${currentTrack.name}`);
  }

  // ==================== XR控制器 ====================

  /**
   * 获取XR控制器
   * @param {THREE.WebGLRenderer} renderer 渲染器
   * @param {number} index 控制器索引
   * @param {THREE.Scene} scene 场景
   * @returns {THREE.XRTargetRaySpace} 控制器对象
   */
  function getXRController(renderer, index, scene) {
    const controller = renderer.xr.getController(index);
    scene.add(controller);

    // 根据开关决定是否显示射线
    if (xrControl.showRayLine) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const line = new THREE.Line(geometry, material);
      line.scale.z = 5;
      line.name = 'rayLine';
      controller.add(line);
      console.log('射线已启用');
    }

    return controller;
  }

  /**
   * 启动XR会话
   */
  function startXRSession() {
    if (!navigator.xr) {
      updateStatus('WebXR不支持，请使用支持WebXR的设备和浏览器');
      return;
    }

    updateStatus('正在启动AR会话...');

    navigator.xr.requestSession('immersive-ar', {})
      .then((session) => {
        console.log('XR会话启动成功');
        updateStatus('AR会话已启动，正在加载模型...');
        setupXRSession(session);
      })
      .catch((err) => {
        console.error('XR会话启动失败:', err);
        updateStatus('AR会话启动失败: ' + err.message);
      });
  }

  /**
   * 更新状态显示
   * @param {string} message 状态消息
   */
  function updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('状态更新:', message);
  }

  /**
   * 切换射线显示
   * @param {THREE.XRTargetRaySpace} controller 控制器对象
   */
  function toggleRayLine(controller) {
    xrControl.showRayLine = !xrControl.showRayLine;

    if (controller) {
      const rayLine = controller.getObjectByName('rayLine');

      if (xrControl.showRayLine && !rayLine) {
        // 添加射线
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, -1)
        ]);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const line = new THREE.Line(geometry, material);
        line.scale.z = 5;
        line.name = 'rayLine';
        controller.add(line);
        console.log('射线已启用');
      } else if (!xrControl.showRayLine && rayLine) {
        // 移除射线
        controller.remove(rayLine);
        rayLine.geometry.dispose();
        rayLine.material.dispose();
        console.log('射线已禁用');
      }
    }

    updateStatus(`射线显示: ${xrControl.showRayLine ? '开启' : '关闭'}`);
  }

  /**
   * 设置XR会话
   * @param {XRSession} session XR会话
   */
  function setupXRSession(session) {
    const renderer = gl
      ? new THREE.WebGLRenderer({ context: gl })
      : new THREE.WebGLRenderer({ antialias: true });

    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');

    if (gl) {
      const baseLayer = new XRWebGLLayer(session, gl);
      session.updateRenderState({ baseLayer });
    }

    // 设置控制器
    const controller = getXRController(renderer, 1, scene);

    // 显示射线切换按钮
    const toggleRayButton = document.getElementById('toggleRay');
    if (toggleRayButton) {
      toggleRayButton.style.display = 'inline-block';
      toggleRayButton.onclick = () => toggleRayLine(controller);
    }

    // 显示测试音频按钮
    const testAudioButton = document.getElementById('testAudio');
    if (testAudioButton) {
      testAudioButton.style.display = 'inline-block';
      testAudioButton.onclick = () => {
        console.log('测试音频播放按钮被点击');
        if (audioState.playMusic && typeof audioState.playMusic === 'function') {
          console.log('播放测试音乐');
          const audio = audioState.playMusic();
          updateStatus('测试音频播放中...');
          setTimeout(() => {
            if (audio) {
              audio.pause();
              updateStatus('测试音频已停止');
            }
          }, 3000);
        } else {
          console.error('音频播放函数未初始化');
          updateStatus('音频系统未初始化');
        }
      };
    }

    // 事件监听
    session.addEventListener('selectstart', onSelectStart(controller));
    session.addEventListener('selectend', onSelectEnd);
    session.addEventListener('end', () => {
      // 隐藏射线切换按钮
      if (toggleRayButton) {
        toggleRayButton.style.display = 'none';
      }
      // 隐藏测试音频按钮
      if (testAudioButton) {
        testAudioButton.style.display = 'none';
      }
      cleanup(renderer, scene);
    });

    renderer.xr.setSession(session);

    // 渲染循环
    renderer.setAnimationLoop(() => {
      // 更新模型动画
      if (animationControl.mixer) {
        const delta = animationControl.clock.getDelta();
        animationControl.mixer.update(delta);
      }

      // 旋转黑胶唱片
      rotateVinyl();

      // 处理控制器交互
      handleControllerInteraction(controller);

      renderer.render(scene, camera);
    });
  }

  // ==================== XR交互处理 ====================

  /**
   * 选择开始事件处理
   * @param {THREE.XRTargetRaySpace} controller 控制器
   * @returns {Function} 事件处理函数
   */
  function onSelectStart(controller) {
    return (evt) => {
      console.log('XR选择开始事件触发');
      const intersects = getIntersections(controller);
      console.log('射线检测结果:', intersects.length, '个对象');

      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        console.log('选中对象:', intersectedObject.name, '用户数据:', intersectedObject.userData);

        // 优先处理按钮交互
        if (intersectedObject.userData.isButton) {
          // 检查是否正在播放动画，防止频繁点击
          if (xrControl.isAnimating) {
            console.log('动画正在播放中，忽略点击');
            return;
          }

          // 播放按钮点击音效
          if (audioState.playButtonClick && typeof audioState.playButtonClick === 'function') {
            audioState.playButtonClick();
          } else {
            console.warn('按钮点击音效未初始化');
          }

          // 判断按钮类型并处理
          if (intersectedObject.userData.buttonType === 'play' || intersectedObject.name.includes('pause_play')) {
            // 设置动画状态为正在播放
            xrControl.isAnimating = true;
            console.log('开始播放按钮动画，禁用点击');

            // 播放按钮：根据当前播放状态决定动画
            let buttonAnimationName;
            if (gameState.playing) {
              // 当前正在播放，点击暂停
              buttonAnimationName = 'button_down';
              stopAnimation(buttonAnimationName);
              xrControl.buttonState = 'up';
              console.log('播放按钮抬起（暂停）');
            } else {
              // 当前暂停，点击播放
              buttonAnimationName = 'button_down';
              playAnimation(buttonAnimationName);
              xrControl.buttonState = 'down';
              console.log('播放按钮按下（播放）');
            }

            // 获取按钮动画的实际持续时间
            const buttonAnimDuration = animationControl.animations[buttonAnimationName]?.duration || 0.8;
            const buttonDelayMs = Math.max(buttonAnimDuration * 1000, 500); // 至少500ms

            console.log(`按钮动画 ${buttonAnimationName} 持续时间: ${buttonAnimDuration}s, 延迟: ${buttonDelayMs}ms`);

            // 等待按钮动画播放完成后再切换播放状态
            setTimeout(() => {
              togglePlayback(() => {
                xrControl.isAnimating = false;
                console.log('按钮防抖延迟结束，恢复点击功能');
              });
            }, buttonDelayMs);

            // // 计算总的防抖时间（按钮动画 + 唱针动画时间）
            // const stylusAnimDuration = gameState.playing ?
            //   (animationControl.animations['stylus_Off']?.duration || 1.0) :
            //   (animationControl.animations['stylus_On']?.duration || 1.0) + (animationControl.animations['stylus_playing']?.duration || 1.0);
            // const totalDelayMs = buttonDelayMs + (stylusAnimDuration) + 200; // 额外200ms缓冲

          }
          //  else if (intersectedObject.userData.buttonType === 'prev') {
          //    // 上一首按钮
          //    playAnimation('button_down');
          //    console.log('上一首按钮被点击');
          //    playPreviousTrack();
          //  } else if (intersectedObject.userData.buttonType === 'next') {
          //    // 下一首按钮
          //    playAnimation('button_down');
          //    console.log('下一首按钮被点击');
          //    playNextTrack();
          //  }

          xrControl.buttonPressed = true;
          updateButtonStateVisual('pressed');
        } else if (intersectedObject.userData.isRotatable) {
          // 可旋转区域：启动模型旋转
          const position = getControllerPosition(controller);
          // 查找最顶层的模型容器进行旋转
          let targetModel = intersectedObject;
          while (targetModel.parent && targetModel.parent !== group) {
            targetModel = targetModel.parent;
          }
          xrControl.selectedModel = targetModel;
          xrControl.isDragging = true;
          xrControl.controllerPrev.copy(position);
          console.log('开始拖拽旋转模型:', xrControl.selectedModel.name);
        }
      }
    };
  }

  /**
   * 选择结束事件处理
   */
  function onSelectEnd() {
    if (xrControl.buttonPressed) {
      xrControl.buttonPressed = false;
      console.log('按钮被释放');
      updateButtonStateVisual(); // 自动根据当前状态更新视觉
    }

    // 结束拖拽旋转
    if (xrControl.isDragging) {
      xrControl.isDragging = false;
      xrControl.selectedModel = null;
      console.log('结束拖拽旋转');
    }
  }

  /**
   * 处理控制器交互
   * @param {THREE.XRTargetRaySpace} controller 控制器
   */
  function handleControllerInteraction(controller) {
    // 处理拖拽旋转
    if (xrControl.isDragging && xrControl.selectedModel) {
      const currentPosition = getControllerPosition(controller);
      const delta = currentPosition.clone().sub(xrControl.controllerPrev);

      delta.multiplyScalar(xrControl.rotationSpeed);
      delta.set(delta.x, -delta.y, 0); // 只使用x和y分量

      applyCameraRelativeRotation(xrControl.selectedModel, delta);
      xrControl.controllerPrev.copy(currentPosition);
    }

    // 检测悬停效果（独立于拖拽状态）
    const intersects = getIntersections(controller);
    let isHoveringButton = false;

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      // console.log('检测到交互对象:', intersectedObject.name, '是否为按钮:', intersectedObject.userData.isButton);

      if (intersectedObject.userData.isButton) {
        isHoveringButton = true;
        if (!xrControl.isHovering && intersectedObject.name === 'pause_play') {
          // 开始悬停
          xrControl.isHovering = true;
          console.log('开始悬停在按钮上', intersectedObject.name);
          updateButtonStateVisual('hover');
        } else {
          // 如果当前没有悬停在按钮上，但之前有悬停状态，则清除悬停
          if (!isHoveringButton && xrControl.isHovering) {
            // 结束悬停
            xrControl.isHovering = false;
            console.log('结束悬停在按钮上');
            updateButtonStateVisual(); // 自动根据当前状态更新视觉
          }
        }
      }
    }

    // 如果当前没有悬停在按钮上，但之前有悬停状态，则清除悬停
    if (!isHoveringButton && xrControl.isHovering) {
      // 结束悬停
      xrControl.isHovering = false;
      console.log('结束悬停在按钮上');
      updateButtonStateVisual(); // 自动根据当前状态更新视觉
    }
  }

  /**
   * 获取交集
   * @param {THREE.XRTargetRaySpace} controller 控制器
   * @returns {Array} 交集数组
   */
  function getIntersections(controller) {
    if (!controller) {
      console.log('控制器为空');
      return [];
    }

    controller.updateMatrixWorld();
    xrControl.raycaster.setFromXRController(controller);

    // 获取射线信息
    const ray = xrControl.raycaster.ray;
    // console.log('射线起点:', ray.origin);
    // console.log('射线方向:', ray.direction);
    // console.log('检测对象数量:', group.children.length);

    const intersects = xrControl.raycaster.intersectObjects(group.children, true);
    // console.log('射线检测到的交集:', intersects.length);

    return intersects;
  }

  /**
   * 获取控制器位置
   * @param {THREE.XRTargetRaySpace} controller 控制器
   * @returns {THREE.Vector3} 位置向量
   */
  function getControllerPosition(controller) {
    if (!controller) {
      console.warn('控制器为空');
      return new THREE.Vector3();
    }

    controller.updateMatrixWorld();
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(controller.matrixWorld);
    return position;
  }

  /**
   * 应用相机相对旋转
   * @param {THREE.Object3D} model 模型对象
   * @param {THREE.Vector3} deltaMove 移动增量
   * @param {number} rotationSpeed 旋转速度
   */
  function applyCameraRelativeRotation(model, deltaMove, rotationSpeed = 0.01) {
    if (!model || !deltaMove) {
      console.warn('模型或移动增量为空');
      return;
    }

    if (!deltaMove.x && !deltaMove.y) {
      return; // 没有移动
    }

    // 创建旋转四元数
    const quaternionY = new THREE.Quaternion();
    const quaternionX = new THREE.Quaternion();

    // Y轴旋转（水平）
    quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaMove.x * rotationSpeed);

    // X轴旋转（垂直）- 限制范围
    const currentEuler = new THREE.Euler();
    currentEuler.setFromQuaternion(model.quaternion, 'YXZ');

    const newXRotation = currentEuler.x + deltaMove.y * rotationSpeed;
    const clampedXRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newXRotation));

    quaternionX.setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      clampedXRotation - currentEuler.x
    );

    // 应用旋转
    model.quaternion.multiplyQuaternions(quaternionY, model.quaternion);
    model.quaternion.multiplyQuaternions(model.quaternion, quaternionX);
  }

  /**
   * 清理资源
   * @param {THREE.WebGLRenderer} renderer 渲染器
   * @param {THREE.Scene} scene 场景
   */
  function cleanup(renderer, scene) {
    console.log('开始清理Lofi FM资源');

    renderer.setAnimationLoop(null);

    // 停止音乐
    pauseMusic();

    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });

    console.log('Lofi FM资源清理完成');
  }

  // ==================== 主流程初始化 ====================

  // 解析参数
  // const params = parseUrlParams();


  // 本地开发环境
  let currentPath = window.location.href;
  if (currentPath.includes('jsar-lofi-fm.html')) {
    currentPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
  } else if (currentPath.endsWith('index.html')) {
    currentPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
  }
  if (!currentPath.endsWith('/')) {
    currentPath += '/';
  }

  const modelUrl = currentPath + 'model/record_player_ani.glb';

// 常量定义
const gl = navigator.gl;

// 初始化场景
const { scene, camera } = initScene();
const group = new THREE.Group();
scene.add(group);

// 游戏状态
const gameState = {
  playing: false,
  stylusOnVinyl: false
};

// 模型组件
const modelComponents = {
  vinyl: null,
  playButton: null,
  stylus: null,
  originalMaterial: null
};

// 音频状态
const audioState = {
  musicAudio: null, // 单例音频实例
  playMusic: null,
  playButtonClick: null,
  currentTrackIndex: 0,
  trackList: [
    { name: 'Lofi Track 1', file: './audio/lofi.mp3' },
    // 可以添加更多音轨
  ]
};

// 动画控制器
const animationControl = {
  mixer: null,
  animations: {},
  clock: new THREE.Clock()
};

// XR控制器
const xrControl = {
  raycaster: new THREE.Raycaster(),
  buttonPressed: false,
  isHovering: false,
  showRayLine: true,  // 射线显示开关
  buttonState: 'up',  // 按钮状态：'up' 或 'down'
  autoStartXR: true,  // 自动启动XR环境开关
  isAnimating: false, // 动画播放状态，用于防抖
  // 旋转控制相关
  selectedModel: null,
  isDragging: false,
  controllerPrev: new THREE.Vector3(),
  rotationSpeed: 3000.0
};

// 鼠标控制器（用于非XR环境测试）
const mouseControl = {
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),
  isHovering: false,
  isClicking: false
};

// 初始化音频
async function initAudio() {
  try {
    audioState.playButtonClick = await createAudioPlayer('./audio/button-click.wav');

    // 根据当前音轨索引加载对应的音频文件
    const currentTrack = audioState.trackList[audioState.currentTrackIndex];
    audioState.playMusic = await createAudioPlayer(currentTrack.file);

    console.log('音频系统初始化完成，当前音轨:', currentTrack.name);
  } catch (error) {
    console.error('音频初始化失败:', error);
    // 确保音频状态不为undefined，提供默认的空函数
    if (!audioState.playButtonClick || typeof audioState.playButtonClick !== 'function') {
      audioState.playButtonClick = () => {
        console.warn('按钮点击音效不可用');
        return {
          play: () => Promise.resolve(),
          pause: () => { },
          volume: 0,
          currentTime: 0
        };
      };
    }
    if (!audioState.playMusic || typeof audioState.playMusic !== 'function') {
      audioState.playMusic = () => {
        console.warn('音乐播放不可用');
        return {
          play: () => Promise.resolve(),
          pause: () => { },
          volume: 0,
          currentTime: 0
        };
      };
    }
  }
}

// 启动应用
async function startApp() {
  await initAudio();

  // 确保 DOM 完全加载后再查找按钮
  setTimeout(() => {
    // 添加按钮事件监听器
    const startButton = document.getElementById('startXR');
    console.log('查找启动按钮:', startButton);

    if (startButton) {
      console.log('成功找到启动按钮');
      setupButtonEvents(startButton);
    } else {
      console.error('找不到启动按钮，DOM 可能未完全加载');
      // 再次尝试查找
      setTimeout(() => {
        const retryButton = document.getElementById('startXR');
        if (retryButton) {
          console.log('重试成功找到启动按钮');
          setupButtonEvents(retryButton);
        } else {
          console.error('重试后仍找不到启动按钮');
        }
      }, 500);
    }
  }, 100);

  // 立即加载模型进行调试
  console.log('开始加载模型进行调试...');
  console.log('模型URL:', modelUrl);
  loadModel(modelUrl, (err) => {
    if (err) {
      console.error('Lofi FM模型加载失败:', err);
      updateStatus('模型加载失败: ' + err.message);
    } else {
      console.log('Lofi FM模型加载完成');
      updateStatus('模型加载完成！');

      console.log('动画系统初始化完成，可用动画:', Object.keys(animationControl.animations));

      // 检查是否自动启动XR
      if (xrControl.autoStartXR) {
        console.log('自动启动XR环境...');
        updateStatus('自动启动AR会话...');

        // 延迟一秒后自动启动，确保模型完全加载
        setTimeout(() => {
          if (navigator.xr) {
            startXRSession();
          } else {
            console.warn('WebXR不支持，无法自动启动');
            updateStatus('WebXR不支持，请手动点击按钮');
          }
        }, 1000);
      }
    }
  });
}

// 设置按钮事件
function setupButtonEvents(startButton) {
  if (startButton) {
    if (xrControl.autoStartXR) {
      // 自动启动模式：隐藏按钮或显示不同文本
      startButton.textContent = '自动启动中...';
      startButton.disabled = true;
      updateStatus('准备就绪，即将自动启动AR体验');
    } else {
      // 手动启动模式：正常显示按钮
      startButton.addEventListener('click', () => {
        if (!navigator.xr) {
          updateStatus('此设备不支持WebXR');
          return;
        }

        startButton.disabled = true;
        startButton.textContent = '正在启动...';

        updateStatus('启动AR会话...');
        startXRSession();
      });

      updateStatus('准备就绪，点击按钮开始体验');
    }
  } else {
    console.error('找不到启动按钮');
  }
}

// 添加全局错误处理
window.addEventListener('unhandledrejection', function (event) {
  console.warn('Unhandled promise rejection:', event.reason);
  // 防止错误冒泡到控制台
  event.preventDefault();
});

// 等待DOM加载完成后启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
}

// ==================== 程序入口 ====================
try {
  console.log('开始初始化Lofi FM应用');
  init();
} catch (error) {
  console.error('Lofi FM应用初始化失败:', error);
}