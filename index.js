#!/usr/bin/env node

const DJI_PREFIX = 'DJI';
const VID_LIST_FILE = 'vidlist';
// TODO: auto detect ffmpeg path
// const FFMPEG_PATH = './bin/ffmpeg/bin/ffmpeg.exe';
const FFMPEG_PATH = '/usr/bin/ffmpeg';
const CONVERTED = 'converted';

const { existsSync, readdirSync, mkdirSync, writeFileSync, rmSync } = require('fs');
const { resolve, join } = require('path');

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { spawn } = require('child_process');
const os = require('node:os');
const argv = yargs(hideBin(process.argv))
    .usage('node ./vidconcat.js -i input_folder_path -o myvideo.mp4 -s 001')
    .alias('i', 'input')
    .demandOption(['i'])
    .argv;

async function combineClip(clip, inputFolderPath) {
  const { sessionName, parts } = clip;
  const content = parts.map(part => {
    return `file ${JSON.stringify(part).slice(1, -1)}`;
  }).join('\n');

  if (!existsSync(join(inputFolderPath, CONVERTED))) {
    mkdirSync(join(inputFolderPath, CONVERTED));
  } 

  const vidListName = `${VID_LIST_FILE}_${sessionName}`;
  const vidListPath = join(inputFolderPath, vidListName);
  const outputFileName = `${sessionName}.mp4`;
  const outputFilePath = join(inputFolderPath, CONVERTED, outputFileName);

  writeFileSync(vidListPath, content);

  // run ffmpeg command
  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(FFMPEG_PATH, [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      vidListPath,
      '-c',
      'copy',
      outputFilePath
    ]);

    // ffmpegProcess.stdout.on('data', (data) => console.log(String(data)));
    ffmpegProcess.stderr.on('data', (data) => console.error(String(data)));
    ffmpegProcess.on('close', (code) => {
      console.log(`Finished processing ${sessionName}, ffmpeg exited with code ${code}`);
      rmSync(vidListPath);

      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    });
  });
}

(async function() {
  // console.log(os.type());
  // read absolute path
  const inputFolderPath = resolve(argv.i);

  // check input folder
  if (!existsSync(inputFolderPath)) {
    throw new Error(`${inputFolderPath} not existed...`);
  }

  // check session
  const fileNames = readdirSync(inputFolderPath);
  const sessions = {};

  fileNames.forEach(fileName => {
    if (!fileName.startsWith(DJI_PREFIX)) {
      return;
    }

    const truncatedFileName = fileName.substring(0, fileName.indexOf('.'));
    const segments = truncatedFileName.split('_');
    const clipName = segments[1];

    if (!sessions[clipName]) {
      sessions[clipName] = [];
    }

    sessions[clipName].push(fileName);
  });

  const clipNames = Object.keys(sessions);
  clipNames.sort((a, b) => Number(a) - Number(b));

  for (let i = 0; i < clipNames.length; i++) {
    const clipName = clipNames[i];
    console.log(`Start processing clip: ${DJI_PREFIX}_${clipName}`);

    const sessionName = `session${i + 1}`;
    const clipParts = sessions[clipName].map(file => join(inputFolderPath, file));
    const clip = {
      sessionName,
      parts: clipParts
    };

    await combineClip(clip, inputFolderPath);
  }
})();
