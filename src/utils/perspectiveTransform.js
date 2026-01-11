export function computePerspectiveTransform(corners, width, height) {
  if (!corners || corners.length !== 4) {
    return null;
  }

  const centerX = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
  const centerY = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;

  const topWidth = Math.sqrt(
    Math.pow(corners[1].x - corners[0].x, 2) + 
    Math.pow(corners[1].y - corners[0].y, 2)
  );
  const bottomWidth = Math.sqrt(
    Math.pow(corners[2].x - corners[3].x, 2) + 
    Math.pow(corners[2].y - corners[3].y, 2)
  );
  const leftHeight = Math.sqrt(
    Math.pow(corners[3].x - corners[0].x, 2) + 
    Math.pow(corners[3].y - corners[0].y, 2)
  );
  const rightHeight = Math.sqrt(
    Math.pow(corners[2].x - corners[1].x, 2) + 
    Math.pow(corners[2].y - corners[1].y, 2)
  );

  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;
  
  const scaleX = avgWidth / width;
  const scaleY = avgHeight / height;

  const dx = corners[1].x - corners[0].x;
  const dy = corners[1].y - corners[0].y;
  const rotateZ = Math.atan2(dy, dx) * (180 / Math.PI);

  const perspectiveX = (topWidth - bottomWidth) / (topWidth + bottomWidth);
  const rotateY = perspectiveX * 45;
  
  const perspectiveY = (leftHeight - rightHeight) / (leftHeight + rightHeight);
  const rotateX = -perspectiveY * 45;

  const translateX = centerX - width / 2;
  const translateY = centerY - height / 2;

  return {
    translateX,
    translateY,
    scaleX: Math.max(0.1, Math.min(3, scaleX)),
    scaleY: Math.max(0.1, Math.min(3, scaleY)),
    rotateX,
    rotateY,
    rotateZ,
    perspective: 500,
    width: avgWidth,
    height: avgHeight,
  };
}

export function getTransformStyle(transform) {
  if (!transform) {
    return {};
  }

  return {
    transform: [
      { perspective: transform.perspective },
      { translateX: transform.translateX },
      { translateY: transform.translateY },
      { rotateZ: `${transform.rotateZ}deg` },
      { rotateY: `${transform.rotateY}deg` },
      { rotateX: `${transform.rotateX}deg` },
      { scaleX: transform.scaleX },
      { scaleY: transform.scaleY },
    ],
  };
}
