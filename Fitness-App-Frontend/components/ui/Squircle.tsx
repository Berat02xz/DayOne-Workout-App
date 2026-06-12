import React, { useMemo } from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { getSvgPath } from "figma-squircle";

type SquircleFrameProps = {
  width: number;
  height: number;
  cornerRadius: number;
  /** 0 = plain rounded rect, 1 = full iOS-style squircle */
  cornerSmoothing?: number;
  /** Must match the background the card sits on */
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Overlay that masks the corners of everything underneath it with an
 * inverse-squircle frame, faking true squircle clipping on a solid
 * background. Place it as the LAST child of a non-clipping container
 * sized exactly width × height.
 */
export function SquircleFrame({
  width,
  height,
  cornerRadius,
  cornerSmoothing = 1,
  color = "#000",
  strokeColor,
  strokeWidth = 1,
  style,
}: SquircleFrameProps) {
  const { frame, outline } = useMemo(() => {
    const squircle = getSvgPath({ width, height, cornerRadius, cornerSmoothing });
    return {
      frame: `M0 0H${width}V${height}H0Z ${squircle}`,
      outline: squircle,
    };
  }, [width, height, cornerRadius, cornerSmoothing]);

  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    >
      <Path d={frame} fill={color} fillRule="evenodd" />
      {strokeColor ? (
        <Path d={outline} stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent" />
      ) : null}
    </Svg>
  );
}

type SquircleSurfaceProps = {
  width: number;
  height: number;
  cornerRadius: number;
  cornerSmoothing?: number;
  fill: string;
  strokeColor?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/** Solid squircle shape — use as an absolute-fill background layer. */
export function SquircleSurface({
  width,
  height,
  cornerRadius,
  cornerSmoothing = 1,
  fill,
  strokeColor,
  strokeWidth = 1,
  style,
}: SquircleSurfaceProps) {
  const path = useMemo(
    () => getSvgPath({ width, height, cornerRadius, cornerSmoothing }),
    [width, height, cornerRadius, cornerSmoothing]
  );

  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    >
      <Path d={path} fill={fill} />
      {strokeColor ? (
        <Path d={path} stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent" />
      ) : null}
    </Svg>
  );
}
