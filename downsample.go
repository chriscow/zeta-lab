package main

import (
	"log"
	"math"
)

// downsampleComplex uses the view bounds (computed from all links) and the output image size,
// so that only links that fall within the same pixel are averaged. Additionally, if two adjacent
// groups are separated by more than one pixel, it linearly interpolates extra points.
// aggressiveness controls how much reduction to do (0.0 = minimal, 1.0 = maximum)
func downsampleComplex(links []complex128, outputSize int, aggressiveness float64, debug bool) []complex128 {
	if len(links) == 0 {
		return links
	}

	if debug {
		log.Printf("Starting downsampleComplex with %d links and output size %d (aggressiveness: %.2f)",
			len(links), outputSize, aggressiveness)
	}

	// Determine view bounds from the links.
	minX, maxX := real(links[0]), real(links[0])
	minY, maxY := imag(links[0]), imag(links[0])
	for _, link := range links {
		x := real(link)
		y := imag(link)
		if x < minX {
			minX = x
		}
		if x > maxX {
			maxX = x
		}
		if y < minY {
			minY = y
		}
		if y > maxY {
			maxY = y
		}
	}
	if debug {
		log.Printf("View bounds: minX=%.6f, maxX=%.6f, minY=%.6f, maxY=%.6f", minX, maxX, minY, maxY)
	}

	// Calculate relative distance between points
	// For small ranges (< 0.01), we should consider them close together
	maxRange := math.Max(maxX-minX, maxY-minY) // Use actual range instead of max value
	baseRange := math.Max(0.01, maxRange)      // Use the range itself as base
	relativeSpread := maxRange / baseRange
	if debug {
		log.Printf("Relative calculations: maxRange=%e, baseRange=%e, relativeSpread=%e", maxRange, baseRange, relativeSpread)
	}

	// Scale the maxRelativeSpread based on aggressiveness
	// At aggressiveness=0.0: 0.01% spread (very precise)
	// At aggressiveness=1.0: 0.1% spread (standard)
	// At aggressiveness=2.0: 1% spread (more aggressive)
	// At aggressiveness=3.0: 2% spread (very aggressive)
	// At aggressiveness=3.5: 3% spread (extremely aggressive)
	// At aggressiveness=4.0: 5% spread (maximum)
	maxRelativeSpread := 0.0001 // Base threshold at 0.01%
	if aggressiveness > 0.0 {
		maxRelativeSpread *= math.Pow(5, aggressiveness)
	}

	// Add extra smoothing for values between 3.5 and 4.0 to avoid the cliff
	if aggressiveness > 3.5 {
		// Smooth transition from 3% to 5% spread
		t := (aggressiveness - 3.5) / 0.5     // 0 to 1 as we go from 3.5 to 4.0
		maxRelativeSpread = 0.03 + (0.02 * t) // Linear interpolation from 3% to 5%
	}

	// Also consider pixel-space proximity for grouping
	pixelSpreadThreshold := 1.0 // Base threshold at 1.0 pixels
	if aggressiveness > 0.0 {
		pixelSpreadThreshold += (aggressiveness * 2.0) // 1.0 to 9.0 pixels
	}

	if debug {
		log.Printf("Using maxRelativeSpread=%e based on aggressiveness=%.2f", maxRelativeSpread, aggressiveness)
	}

	// If the relative spread is small enough, average the points
	if relativeSpread <= maxRelativeSpread {
		if debug {
			log.Printf("Points are relatively close: %e <= %e", relativeSpread, maxRelativeSpread)
		}
		var sum complex128
		for _, link := range links {
			sum += link
		}
		avg := sum / complex(float64(len(links)), 0)
		if debug {
			log.Printf("Computed average of %d points: %.6f + %.6fi", len(links), real(avg), imag(avg))
		}
		return []complex128{avg}
	}
	if debug {
		log.Printf("Points are too far apart relatively: %e > %e", relativeSpread, maxRelativeSpread)
	}

	// Helper to compute pixel coordinate for a given link.
	pixelForLink := func(link complex128) (int, int) {
		normalizedX := (real(link) - minX) / (maxX - minX)
		normalizedY := (imag(link) - minY) / (maxY - minY)
		px := int(math.Round(normalizedX * float64(outputSize)))
		py := int(math.Round(normalizedY * float64(outputSize)))
		if debug {
			log.Printf("Mapping point (%.6f,%.6f) to pixel (%d,%d) [normalized: %.6f,%.6f]",
				real(link), imag(link), px, py, normalizedX, normalizedY)
		}
		return px, py
	}

	// We'll accumulate groups of contiguous links that fall into the same pixel.
	type groupData struct {
		sum      complex128
		count    int
		pixelX   int
		pixelY   int
		lastLink complex128 // last link value in this group; used for interpolation
	}

	var downsampled []complex128

	// Initialize the first group.
	initPx, initPy := pixelForLink(links[0])
	currentGroup := groupData{
		sum:      links[0],
		count:    1,
		pixelX:   initPx,
		pixelY:   initPy,
		lastLink: links[0],
	}

	// Flush a group by averaging it.
	flushGroup := func(g groupData) complex128 {
		avg := g.sum / complex(float64(g.count), 0)
		if debug {
			log.Printf("Flushing group: pixel=(%d,%d), count=%d, avg=(%.6f,%.6f)",
				g.pixelX, g.pixelY, g.count, real(avg), imag(avg))
		}
		return avg
	}

	// Iterate over the links.
	for i := 1; i < len(links); i++ {
		link := links[i]
		px, py := pixelForLink(link)

		// Check if this point is close enough to be considered in the same pixel
		if px == currentGroup.pixelX && py == currentGroup.pixelY ||
			(math.Abs(float64(px-currentGroup.pixelX)) <= pixelSpreadThreshold &&
				math.Abs(float64(py-currentGroup.pixelY)) <= pixelSpreadThreshold) {
			// Same pixel or within threshold: accumulate.
			currentGroup.sum += link
			currentGroup.count++
			currentGroup.lastLink = link
			continue
		}

		// Group changed: flush the current group.
		avg := flushGroup(currentGroup)
		downsampled = append(downsampled, avg)

		// Check gap in pixel coordinates from the previous group to the current link.
		dx := px - currentGroup.pixelX
		dy := py - currentGroup.pixelY
		pixelGap := math.Sqrt(float64(dx*dx + dy*dy))

		// Scale the interpolation threshold based on aggressiveness
		// At aggressiveness=0.0: gaps > 1.1 pixels (very detailed)
		// At aggressiveness=1.0: gaps > 5 pixels (standard)
		// At aggressiveness=2.0: gaps > 15 pixels (more aggressive)
		// At aggressiveness=3.0: gaps > 35 pixels (very aggressive)
		// At aggressiveness=3.5: gaps > 55 pixels (extremely aggressive)
		// At aggressiveness=4.0: gaps > 75 pixels (maximum)
		interpolationThreshold := 1.1 * math.Pow(2.5, aggressiveness)

		// Add extra smoothing for values between 3.5 and 4.0
		if aggressiveness > 3.5 {
			// Smooth transition from 55 to 75 pixels
			t := (aggressiveness - 3.5) / 0.5
			interpolationThreshold = 55.0 + (20.0 * t)
		}

		// Only interpolate if the gap is significantly larger than one pixel
		if pixelGap > interpolationThreshold {
			// Interpolate extra points, reducing count more aggressively at higher values
			// Also smooth the steps reduction for high aggressiveness
			steps := int(pixelGap / math.Pow(2, math.Min(aggressiveness, 3.5)))
			if aggressiveness > 3.5 {
				// Further reduce steps linearly from 3.5 to 4.0
				t := (aggressiveness - 3.5) / 0.5
				steps = int(float64(steps) * (1.0 - (0.5 * t))) // Reduce by up to 50% more
			}
			if debug {
				log.Printf("Interpolating %d points between pixel=(%d,%d) and pixel=(%d,%d) (threshold: %.2f)",
					steps, currentGroup.pixelX, currentGroup.pixelY, px, py, interpolationThreshold)
			}
			for s := 1; s <= steps; s++ {
				t := float64(s) / float64(steps+1)
				interp := currentGroup.lastLink*(1-complex(t, 0)) + link*complex(t, 0)
				downsampled = append(downsampled, interp)
			}
		}

		// Start a new group with the current link.
		currentGroup = groupData{
			sum:      link,
			count:    1,
			pixelX:   px,
			pixelY:   py,
			lastLink: link,
		}
	}

	// Flush any remaining group.
	finalAvg := flushGroup(currentGroup)
	downsampled = append(downsampled, finalAvg)

	if debug {
		log.Printf("Downsampled %d points to %d points", len(links), len(downsampled))
	}
	return downsampled
}
