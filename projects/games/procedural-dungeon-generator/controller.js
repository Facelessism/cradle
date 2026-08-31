import { DungeonGenerator } from './generator.js';
import { DungeonRenderer } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const renderer = new DungeonRenderer('dungeon-canvas');

    const btnGenerate = document.getElementById('btn-generate');
    const inputWidth = document.getElementById('map-width');
    const inputHeight = document.getElementById('map-height');
    const inputMinRoom = document.getElementById('min-room-size');
    const inputSeed = document.getElementById('seed');

    function generateDungeon() {
        const width = parseInt(inputWidth.value, 10) || 40;
        const height = parseInt(inputHeight.value, 10) || 30;
        const minRoom = parseInt(inputMinRoom.value, 10) || 4;
        const seed = inputSeed.value ? parseInt(inputSeed.value, 10) : null;

        const generator = new DungeonGenerator(width, height, minRoom, seed);
        const map = generator.generate();

        renderer.render(map);

        // Update seed input with the actual seed used if it was random
        if (!inputSeed.value) {
            inputSeed.value = generator.seed;
        }
    }

    btnGenerate.addEventListener('click', generateDungeon);

    // Generate initial dungeon
    generateDungeon();

    // Regenerate on theme change to update colors
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        generateDungeon();
    });
});
