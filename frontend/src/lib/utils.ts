import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function rgbCss(red: number, green: number, blue: number) {
  return `rgb(${red} ${green} ${blue})`
}

export function kelvinToRgb(kelvin: number) {
  const temperature = kelvin / 100
  let red: number
  let blue: number
  if (temperature <= 66) red = 255
  else red = Math.min(255, Math.max(0, 329.698727446 * (temperature - 60) ** -0.1332047592))
  let green: number
  if (temperature <= 66) green = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temperature) - 161.1195681661))
  else green = Math.min(255, Math.max(0, 288.1221695283 * (temperature - 60) ** -0.0755148492))
  if (temperature >= 66) blue = 255
  else if (temperature <= 19) blue = 0
  else blue = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temperature - 10) - 305.0447927307))
  return { r: Math.round(red), g: Math.round(green), b: Math.round(blue) }
}

export function kelvinCss(kelvin: number) {
  const { r, g, b } = kelvinToRgb(kelvin)
  return rgbCss(r, g, b)
}
