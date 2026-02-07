import { useRef, useEffect } from 'react'

export function FaceMeshCanvas({ faceLandmarks, showFaceMesh }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (showFaceMesh && faceLandmarks) {
      const width = canvas.width
      const height = canvas.height

      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 1

      faceLandmarks.forEach((landmarks) => {
        landmarks.forEach((landmark) => {
          const x = (1 - landmark.x) * width
          const y = landmark.y * height

          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = '#00ff00'
          ctx.fill()
        })

        drawConnection(ctx, landmarks, [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10], width, height)
        drawConnection(ctx, landmarks, [46, 53, 52, 65, 55], width, height)
        drawConnection(ctx, landmarks, [276, 283, 282, 295, 285], width, height)
        drawConnection(ctx, landmarks, [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33], width, height)
        drawConnection(ctx, landmarks, [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362], width, height)
        drawConnection(ctx, landmarks, [6, 197, 195, 5, 4], width, height)
        drawConnection(ctx, landmarks, [48, 115, 220, 45, 4, 275, 440, 344], width, height)
        drawConnection(ctx, landmarks, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], width, height)
        drawConnection(ctx, landmarks, [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78], width, height)
      })
    }
  }, [faceLandmarks, showFaceMesh])

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      className="absolute top-0 left-0 rounded-lg pointer-events-none"
      style={{ width: '640px', height: '480px' }}
    />
  )
}

function drawConnection(ctx, landmarks, indices, width, height) {
  ctx.beginPath()
  indices.forEach((index, i) => {
    const landmark = landmarks[index]
    if (landmark) {
      const x = (1 - landmark.x) * width
      const y = landmark.y * height
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
  })
  ctx.stroke()
}
