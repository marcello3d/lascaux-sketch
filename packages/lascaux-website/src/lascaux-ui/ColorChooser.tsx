import styles from './ColorChooser.module.css';
import React, { useMemo } from 'react';
import { toCssRgbaColor } from '../lascaux/util/parse-color';
import { rgbaColorPalette } from './color-palette';
import { Button } from '../ui/Button';
import { Color } from '../lascaux/DrawingDoc';

export const ColorChooser = React.memo(function ColorChooser({
  color,
  onChangeColor,
}: {
  color: Color;
  onChangeColor: (color: Color) => void;
}) {
  const selectedColorCss = toCssRgbaColor(color);

  const currentColorStyle = useMemo(
    () => ({ backgroundColor: selectedColorCss }),
    [selectedColorCss],
  );

  return (
    <div className={styles.colorButtons}>
      <div className={styles.currentColor} style={currentColorStyle} />
      {rgbaColorPalette.map((color, index) => (
        <ColorButton
          key={index}
          color={color}
          onChangeColor={onChangeColor}
          selectedColorCss={selectedColorCss}
        />
      ))}
    </div>
  );
});

const ColorButton = function ColorButton({
  color,
  selectedColorCss,
  onChangeColor,
}: {
  color: Color;
  selectedColorCss: string;
  onChangeColor: (color: Color) => void;
}) {
  const colorCss = toCssRgbaColor(color);
  const selected = colorCss === selectedColorCss;
  return (
    <Button
      onClick={() => onChangeColor(color)}
      className={styles.colorButton}
      style={{
        backgroundColor: colorCss,
        border: selected ? 'solid 2px white' : `solid 2px ${colorCss}`,
      }}
    />
  );
};
