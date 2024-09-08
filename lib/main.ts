// 监听 spaceReady 事件
// spaceDocument.addEventListener('spaceReady', () => {
//   const scene = spaceDocument.scene as BABYLON.Scene;
  
//   scene.animationGroups.forEach(ag => {
//     console.log('开始播放动画:', ag.name);
//     ag.start(true);
//   });
// });



async function playAudioLoop() {
  // 创建音频对象并设置循环播放
  const arrayBuffer = await import(`../audio/lofi.mp3`);
  const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio.loop = true; // 设置循环
  audio.play();
}

playAudioLoop(); // 自动播放