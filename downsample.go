package main

import (
	"log"
	"math"
	"runtime"
	"sync"
)

// downsampleComplexSerial is the original serial version of the downsampling algorithm
func downsampleComplexSerial(links []complex128, outputSize int, aggressiveness float64, debug bool) []complex128 {
	if len(links) == 0 {
		return links
	}

	if debug {
		log.Printf("Starting downsampleComplexSerial with %d links and output size %d (aggressiveness: %.2f)",
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

	// Calculate relative distance between points
	maxRange := math.Max(maxX-minX, maxY-minY)
	baseRange := math.Max(0.01, maxRange)
	relativeSpread := maxRange / baseRange

	// Scale the maxRelativeSpread based on aggressiveness
	maxRelativeSpread := 0.0001 // Base threshold at 0.01%
	if aggressiveness > 0.0 {
		maxRelativeSpread *= math.Pow(5, aggressiveness)
	}

	// Add extra smoothing for values between 3.5 and 4.0
	if aggressiveness > 3.5 {
		t := (aggressiveness - 3.5) / 0.5
		maxRelativeSpread = 0.03 + (0.02 * t)
	}

	// Also consider pixel-space proximity for grouping
	pixelSpreadThreshold := 1.0
	if aggressiveness > 0.0 {
		pixelSpreadThreshold += (aggressiveness * 2.0)
	}

	// If the relative spread is small enough, average all points
	if relativeSpread <= maxRelativeSpread {
		var sum complex128
		for _, link := range links {
			sum += link
		}
		avg := sum / complex(float64(len(links)), 0)
		return []complex128{avg}
	}

	// Helper to compute pixel coordinate for a link
	pixelForLink := func(link complex128) (int, int) {
		normalizedX := (real(link) - minX) / (maxX - minX)
		normalizedY := (imag(link) - minY) / (maxY - minY)
		px := int(math.Round(normalizedX * float64(outputSize)))
		py := int(math.Round(normalizedY * float64(outputSize)))
		return px, py
	}

	// Calculate interpolation threshold based on aggressiveness
	interpolationThreshold := 1.1 * math.Pow(2.5, aggressiveness)
	if aggressiveness > 3.5 {
		t := (aggressiveness - 3.5) / 0.5
		interpolationThreshold = 55.0 + (20.0 * t)
	}

	var downsampled []complex128
	type groupData struct {
		sum      complex128
		count    int
		pixelX   int
		pixelY   int
		lastLink complex128
	}

	// Initialize with first point
	initPx, initPy := pixelForLink(links[0])
	currentGroup := groupData{
		sum:      links[0],
		count:    1,
		pixelX:   initPx,
		pixelY:   initPy,
		lastLink: links[0],
	}

	// Helper to flush a group
	flushGroup := func(g groupData) complex128 {
		return g.sum / complex(float64(g.count), 0)
	}

	// Process all points sequentially
	for i := 1; i < len(links); i++ {
		link := links[i]
		px, py := pixelForLink(link)

		// Check if this point belongs to current group
		if px == currentGroup.pixelX && py == currentGroup.pixelY ||
			(math.Abs(float64(px-currentGroup.pixelX)) <= pixelSpreadThreshold &&
				math.Abs(float64(py-currentGroup.pixelY)) <= pixelSpreadThreshold) {
			currentGroup.sum += link
			currentGroup.count++
			currentGroup.lastLink = link
			continue
		}

		// Group changed: flush current group
		avg := flushGroup(currentGroup)
		downsampled = append(downsampled, avg)

		// Check for interpolation
		dx := px - currentGroup.pixelX
		dy := py - currentGroup.pixelY
		pixelGap := math.Sqrt(float64(dx*dx + dy*dy))

		if pixelGap > interpolationThreshold {
			steps := int(pixelGap / math.Pow(2, math.Min(aggressiveness, 3.5)))
			if aggressiveness > 3.5 {
				t := (aggressiveness - 3.5) / 0.5
				steps = int(float64(steps) * (1.0 - (0.5 * t)))
			}

			for s := 1; s <= steps; s++ {
				t := float64(s) / float64(steps+1)
				interp := currentGroup.lastLink*(1-complex(t, 0)) + link*complex(t, 0)
				downsampled = append(downsampled, interp)
			}
		}

		// Start new group
		currentGroup = groupData{
			sum:      link,
			count:    1,
			pixelX:   px,
			pixelY:   py,
			lastLink: link,
		}
	}

	// Flush final group
	finalAvg := flushGroup(currentGroup)
	downsampled = append(downsampled, finalAvg)

	if debug {
		log.Printf("Downsampled %d points to %d points", len(links), len(downsampled))
	}
	return downsampled
}

// downsampleComplex uses the view bounds (computed from all links) and the output image size,
// so that only links that fall within the same pixel are averaged. Additionally, if two adjacent
// groups are separated by more than one pixel, it linearly interpolates extra points.
// aggressiveness controls how much reduction to do (0.0 = minimal, 1.0 = maximum)
func downsampleComplex(links []complex128, outputSize int, aggressiveness float64, debug bool) []complex128 {

	// There is not much point in parallelizing for small numbers of links - benefits are minimal
	if len(links) < 10000 {
		return downsampleComplexSerial(links, outputSize, aggressiveness, debug)
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
	maxRange := math.Max(maxX-minX, maxY-minY)
	baseRange := math.Max(0.01, maxRange)
	relativeSpread := maxRange / baseRange
	if debug {
		log.Printf("Relative calculations: maxRange=%e, baseRange=%e, relativeSpread=%e", maxRange, baseRange, relativeSpread)
	}

	// Scale the maxRelativeSpread based on aggressiveness
	maxRelativeSpread := 0.0001 // Base threshold at 0.01%
	if aggressiveness > 0.0 {
		maxRelativeSpread *= math.Pow(5, aggressiveness)
	}

	// Add extra smoothing for values between 3.5 and 4.0
	if aggressiveness > 3.5 {
		t := (aggressiveness - 3.5) / 0.5
		maxRelativeSpread = 0.03 + (0.02 * t)
	}

	// Also consider pixel-space proximity for grouping
	pixelSpreadThreshold := 1.0
	if aggressiveness > 0.0 {
		pixelSpreadThreshold += (aggressiveness * 2.0)
	}

	if debug {
		log.Printf("Using maxRelativeSpread=%e based on aggressiveness=%.2f", maxRelativeSpread, aggressiveness)
	}

	// If the relative spread is small enough, average all points
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

	// Helper to compute pixel coordinate for a link.
	pixelForLink := func(link complex128) (int, int) {
		normalizedX := (real(link) - minX) / (maxX - minX)
		normalizedY := (imag(link) - minY) / (maxY - minY)
		px := int(math.Round(normalizedX * float64(outputSize)))
		py := int(math.Round(normalizedY * float64(outputSize)))
		return px, py
	}

	// Calculate interpolation threshold based on aggressiveness
	interpolationThreshold := 1.1 * math.Pow(2.5, aggressiveness)
	if aggressiveness > 3.5 {
		t := (aggressiveness - 3.5) / 0.5
		interpolationThreshold = 55.0 + (20.0 * t)
	}

	// Process chunks in parallel
	numWorkers := runtime.NumCPU()
	chunkSize := (len(links) + numWorkers - 1) / numWorkers

	type chunkResult struct {
		index     int
		points    []complex128
		lastPoint complex128
		lastPx    int
		lastPy    int
	}

	results := make(chan chunkResult, numWorkers)
	var wg sync.WaitGroup

	// Process each chunk
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		start := w * chunkSize
		end := start + chunkSize
		if end > len(links) {
			end = len(links)
		}

		go func(worker, start, end int) {
			defer wg.Done()

			if start >= end {
				results <- chunkResult{index: worker}
				return
			}

			// Initialize chunk processing
			var chunkPoints []complex128
			type groupData struct {
				sum      complex128
				count    int
				pixelX   int
				pixelY   int
				lastLink complex128
			}

			// Start with the first point in the chunk
			initPx, initPy := pixelForLink(links[start])
			currentGroup := groupData{
				sum:      links[start],
				count:    1,
				pixelX:   initPx,
				pixelY:   initPy,
				lastLink: links[start],
			}

			// Helper to flush a group
			flushGroup := func(g groupData) complex128 {
				return g.sum / complex(float64(g.count), 0)
			}

			// Process points in the chunk
			for i := start + 1; i < end; i++ {
				link := links[i]
				px, py := pixelForLink(link)

				// Check if this point belongs to current group
				if px == currentGroup.pixelX && py == currentGroup.pixelY ||
					(math.Abs(float64(px-currentGroup.pixelX)) <= pixelSpreadThreshold &&
						math.Abs(float64(py-currentGroup.pixelY)) <= pixelSpreadThreshold) {
					currentGroup.sum += link
					currentGroup.count++
					currentGroup.lastLink = link
					continue
				}

				// Group changed: flush current group
				avg := flushGroup(currentGroup)
				chunkPoints = append(chunkPoints, avg)

				// Check for interpolation
				dx := px - currentGroup.pixelX
				dy := py - currentGroup.pixelY
				pixelGap := math.Sqrt(float64(dx*dx + dy*dy))

				if pixelGap > interpolationThreshold {
					steps := int(pixelGap / math.Pow(2, math.Min(aggressiveness, 3.5)))
					if aggressiveness > 3.5 {
						t := (aggressiveness - 3.5) / 0.5
						steps = int(float64(steps) * (1.0 - (0.5 * t)))
					}

					for s := 1; s <= steps; s++ {
						t := float64(s) / float64(steps+1)
						interp := currentGroup.lastLink*(1-complex(t, 0)) + link*complex(t, 0)
						chunkPoints = append(chunkPoints, interp)
					}
				}

				// Start new group
				currentGroup = groupData{
					sum:      link,
					count:    1,
					pixelX:   px,
					pixelY:   py,
					lastLink: link,
				}
			}

			// Flush final group
			finalAvg := flushGroup(currentGroup)
			chunkPoints = append(chunkPoints, finalAvg)

			results <- chunkResult{
				index:     worker,
				points:    chunkPoints,
				lastPoint: currentGroup.lastLink,
				lastPx:    currentGroup.pixelX,
				lastPy:    currentGroup.pixelY,
			}
		}(w, start, end)
	}

	// Close results channel when all workers are done
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect and merge results
	type collectedResult struct {
		points    []complex128
		lastPoint complex128
		lastPx    int
		lastPy    int
	}
	collected := make([]collectedResult, numWorkers)

	// Collect all results
	for result := range results {
		collected[result.index] = collectedResult{
			points:    result.points,
			lastPoint: result.lastPoint,
			lastPx:    result.lastPx,
			lastPy:    result.lastPy,
		}
	}

	// Merge results with interpolation between chunks
	var finalPoints []complex128
	for i := 0; i < len(collected); i++ {
		if len(collected[i].points) == 0 {
			continue
		}

		// Add points from this chunk
		finalPoints = append(finalPoints, collected[i].points...)

		// If not the last chunk and next chunk has points, check if interpolation is needed
		if i < len(collected)-1 && len(collected[i+1].points) > 0 {
			// Check distance between chunks
			dx := collected[i+1].lastPx - collected[i].lastPx
			dy := collected[i+1].lastPy - collected[i].lastPy
			gap := math.Sqrt(float64(dx*dx + dy*dy))

			if gap > interpolationThreshold {
				steps := int(gap / math.Pow(2, math.Min(aggressiveness, 3.5)))
				if aggressiveness > 3.5 {
					t := (aggressiveness - 3.5) / 0.5
					steps = int(float64(steps) * (1.0 - (0.5 * t)))
				}

				nextFirstPoint := collected[i+1].points[0]
				for s := 1; s <= steps; s++ {
					t := float64(s) / float64(steps+1)
					interp := collected[i].lastPoint*(1-complex(t, 0)) + nextFirstPoint*complex(t, 0)
					finalPoints = append(finalPoints, interp)
				}
			}
		}
	}

	if debug {
		log.Printf("Downsampled %d points to %d points", len(links), len(finalPoints))
	}
	return finalPoints
}
