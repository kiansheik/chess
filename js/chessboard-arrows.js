class SimpleArrowOverlay {
    constructor(wrapperId, resFactor = 2) {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
      this.resFactor = resFactor;
      this.arrows = []; // now stores {from, to, color}
  
      const wrapper = document.getElementById(wrapperId);
      const board = wrapper.querySelector('#board');
      const rect = board.getBoundingClientRect();
  
      this.canvas.width = rect.width * resFactor;
      this.canvas.height = rect.height * resFactor;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = board.offsetTop + 'px';
      this.canvas.style.left = board.offsetLeft + 'px';
      this.canvas.style.pointerEvents = 'none';
  
      wrapper.appendChild(this.canvas);
      this.context.scale(resFactor, resFactor);
    }
  
    addArrow(fromSquare, toSquare, color = 'rgba(255, 0, 0, 0.8)') {
      this.arrows.push({ from: fromSquare, to: toSquare, color });
      this.render();
    }
  
    clear() {
      this.arrows = [];
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  
    render() {
      const squareSize = this.canvas.width / 8 / this.resFactor;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      for (const arrow of this.arrows) {
        const from = this.squareToXY(arrow.from, squareSize);
        const to = this.squareToXY(arrow.to, squareSize);
        this.drawArrow(from, to, squareSize, arrow.color);
      }
    }
  
    squareToXY(square, size) {
      const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
      const rank = 8 - parseInt(square[1], 10);
      return {
        x: file * size + size / 2,
        y: rank * size + size / 2
      };
    }
  
    drawArrow(from, to, squareSize, color) {
      const ctx = this.context;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
  
      // Arrowhead
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const headLength = squareSize * 0.3;
      const headX = to.x - headLength * Math.cos(angle);
      const headY = to.y - headLength * Math.sin(angle);
  
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(
        headX + headLength * Math.sin(angle) * 0.5,
        headY - headLength * Math.cos(angle) * 0.5
      );
      ctx.lineTo(
        headX - headLength * Math.sin(angle) * 0.5,
        headY + headLength * Math.cos(angle) * 0.5
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  