/**
 * Dungeon Renderer
 * Handles Canvas 2D drawing of the tile map.
 */
export class DungeonRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 16; // Base size, scaled by CSS
    }

    render(map) {
        const height = map.length;
        const width = map[0].length;

        this.canvas.width = width * this.tileSize;
        this.canvas.height = height * this.tileSize;

        // Get colors from CSS variables for theme support
        const styles = getComputedStyle(document.documentElement);
        const colorFloor = styles.getPropertyValue('--color-floor').trim();
        const colorWall = styles.getPropertyValue('--color-wall').trim();
        const colorDoor = styles.getPropertyValue('--color-door').trim();
        const colorStart = styles.getPropertyValue('--color-start').trim();
        const colorEnd = styles.getPropertyValue('--color-end').trim();

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = map[y][x];
                let color = colorWall;

                if (tile === 0) color = colorFloor;
                else if (tile === 2) color = colorStart;
                else if (tile === 3) color = colorEnd;

                // Simple door detection: floor adjacent to wall
                if (tile === 0 && this.isDoor(map, x, y)) {
                    color = colorDoor;
                }

                this.ctx.fillStyle = color;
                this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);

                // Add subtle grid lines
                this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                this.ctx.strokeRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
            }
        }
    }

    isDoor(map, x, y) {
        const height = map.length;
        const width = map[0].length;
        let wallCount = 0;

        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (map[ny][nx] === 1) wallCount++;
            } else {
                wallCount++;
            }
        }
        // A door is a floor tile with exactly 2 opposite walls (corridor) or specific wall adjacency
        return wallCount === 2 || wallCount === 3;
    }
}
