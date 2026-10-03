import plusSvg from "@tabler/icons/outline/plus.svg?raw";
import trashSvg from "@tabler/icons/outline/trash.svg?raw";
import copySvg from "@tabler/icons/outline/copy.svg?raw";
import chevronUpSvg from "@tabler/icons/outline/chevron-up.svg?raw";
import chevronDownSvg from "@tabler/icons/outline/chevron-down.svg?raw";
import photoSvg from "@tabler/icons/outline/photo.svg?raw";
import docxSvg from "@tabler/icons/outline/file-type-docx.svg?raw";
import codeSvg from "@tabler/icons/outline/code.svg?raw";
import dotsSvg from "@tabler/icons/outline/dots.svg?raw";
import cloudSvg from "@tabler/icons/outline/cloud.svg?raw";
import xSvg from "@tabler/icons/outline/x.svg?raw";
import checkSvg from "@tabler/icons/outline/check.svg?raw";
import eyeSvg from "@tabler/icons/outline/eye.svg?raw";
import menuSvg from "@tabler/icons/outline/menu-2.svg?raw";
import pencilSvg from "@tabler/icons/outline/pencil.svg?raw";
import copyPlusSvg from "@tabler/icons/outline/copy-plus.svg?raw";
import downloadSvg from "@tabler/icons/outline/download.svg?raw";
import uploadSvg from "@tabler/icons/outline/upload.svg?raw";
import refreshSvg from "@tabler/icons/outline/refresh.svg?raw";
import fileSvg from "@tabler/icons/outline/file.svg?raw";
import moonSvg from "@tabler/icons/outline/moon.svg?raw";
import sunSvg from "@tabler/icons/outline/sun.svg?raw";
import collapseSvg from "@tabler/icons/outline/layout-sidebar-left-collapse.svg?raw";
import expandSvg from "@tabler/icons/outline/layout-sidebar-left-expand.svg?raw";
import searchSvg from "@tabler/icons/outline/search.svg?raw";
import replaceSvg from "@tabler/icons/outline/replace.svg?raw";
import commandSvg from "@tabler/icons/outline/command.svg?raw";
import focusSvg from "@tabler/icons/outline/focus-2.svg?raw";
import unfocusSvg from "@tabler/icons/outline/minimize.svg?raw";
import historySvg from "@tabler/icons/outline/history.svg?raw";
import undoSvg from "@tabler/icons/outline/arrow-back-up.svg?raw";
import redoSvg from "@tabler/icons/outline/arrow-forward-up.svg?raw";
import markdownSvg from "@tabler/icons/outline/markdown.svg?raw";
import textFileSvg from "@tabler/icons/outline/file-type-txt.svg?raw";
import stickerSvg from "@tabler/icons/outline/mood-smile.svg?raw";
import keyboardSvg from "@tabler/icons/outline/keyboard.svg?raw";
import monitorSvg from "@tabler/icons/outline/device-desktop.svg?raw";
import dragSvg from "@tabler/icons/outline/grip-vertical.svg?raw";
import boldSvg from "@tabler/icons/outline/bold.svg?raw";
import italicSvg from "@tabler/icons/outline/italic.svg?raw";
import diagnosticSvg from "@tabler/icons/outline/alert-circle.svg?raw";
import layersSvg from "@tabler/icons/outline/stack-2.svg?raw";
import sparkleSvg from "@tabler/icons/outline/sparkles.svg?raw";

const tablerSvgs = {
  plus: plusSvg,
  trash: trashSvg,
  copy: copySvg,
  up: chevronUpSvg,
  down: chevronDownSvg,
  image: photoSvg,
  doc: docxSvg,
  code: codeSvg,
  dots: dotsSvg,
  cloud: cloudSvg,
  x: xSvg,
  check: checkSvg,
  eye: eyeSvg,
  menu: menuSvg,
  pencil: pencilSvg,
  dup: copyPlusSvg,
  download: downloadSvg,
  upload: uploadSvg,
  refresh: refreshSvg,
  file: fileSvg,
  moon: moonSvg,
  sun: sunSvg,
  collapse: collapseSvg,
  expand: expandSvg,
  search: searchSvg,
  replace: replaceSvg,
  command: commandSvg,
  focus: focusSvg,
  unfocus: unfocusSvg,
  history: historySvg,
  undo: undoSvg,
  redo: redoSvg,
  md: markdownSvg,
  txt: textFileSvg,
  sticker: stickerSvg,
  keyboard: keyboardSvg,
  monitor: monitorSvg,
  drag: dragSvg,
  caret: chevronDownSvg,
  bold: boldSvg,
  italic: italicSvg,
  diag: diagnosticSvg,
  layers: layersSvg,
  sparkle: sparkleSvg,
};

const iconContents = Object.fromEntries(
  Object.entries(tablerSvgs).map(([name, svg]) => [
    name,
    svg.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, ""),
  ]),
);

/** Inline the official Tabler outline SVGs so the built app stays a single file. */
export const icon = name => {
  const key = Object.hasOwn(iconContents, name) ? name : "file";
  return '<svg class="ic icon-tabler icon-tabler-' + key + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    iconContents[key] +
    "</svg>";
};
