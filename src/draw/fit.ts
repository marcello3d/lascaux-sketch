export function containInBox(width: number, height: number, boxWidth: number, boxHeight: number): [ number, number ] {
  if (width/height > boxWidth/boxHeight) {
    return [boxWidth, boxWidth * height/width];
  }
  return [boxHeight * width/height, boxHeight];
}
