import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath } from 'react-native-svg';
import type { ShapeMasks } from '../core/collection';
import { SaveSystem } from '../core/saveSystem';
import { startGalleryCollectionSync } from './collectionSync';
import {
  galleryLayout,
  galleryTileOrigin,
  galleryTilePath,
  galleryWall,
  type GalleryLayout,
  type GalleryTile,
} from './galleryLayout';
import { HeaderButton } from './HeaderButton';
import { useEffectUntilScreenLeaves } from './screenHandoff';
import { Palette, Type } from './theme';

/**
 * W4-09 (META_GALLERY): the shape gallery. A calm, non-tappable wall of the
 * catalogue's silhouettes: a collected shape is filled in `ink` with its name
 * under it; one not yet collected is outlined (no fill, no name); a retired
 * shape shows only if collected. One count line, `N of M`. No level numbers,
 * stars, scores or motion, and nothing on the wall is pressable, so it cannot
 * read as, or work as, a level select. The ‹ button and Android's hardware
 * back return to the menu. Opening it catches the collection up (W4-07's
 * sliced fold) and the wall fills as the bits arrive.
 *
 * Fix round 1 (controller, owner rule "no dropped frames"): every silhouette
 * is a Path in ONE `Svg` behind the grid. react-native-svg's Android SvgView
 * rasterises each Svg into its own bitmap in onDraw, so 26 per-tile Svgs made
 * the gallery's first frame a median 79 ms on the API 31 emulator
 * (docs/next-level/reports/W4-09.md). The names stay RN `Text` in the grid's
 * cells, so the pixels are unchanged.
 */

/** The count line's copy. OWNER-PICKED STARTING VALUE (copy). */
export function galleryCountLabel(collected: number, total: number): string {
  return `${collected} of ${total}`; // OWNER-PICKED STARTING VALUE
}

/** Outline width of a shape not yet collected, dp (the spent heart pip is ~1.8 dp). */
export const GALLERY_OUTLINE_DP = 1.5; // OWNER-PICKED STARTING VALUE

export function GalleryScreen({
  palette,
  onBack,
}: {
  palette: Palette;
  /** The ‹ button or Android's hardware back: return to the menu. */
  onBack: () => void;
}) {
  const p = palette;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = galleryLayout(width);
  const [masks, setMasks] = useState<ShapeMasks>(() => SaveSystem.shapesSeen);

  // W4-07 backfill: fold from the first frame after opening (sliced, off the
  // mount) and show each slice's new bits. FINAL-FIX: leaving the gallery (or
  // unmounting it) stops it, like the menu's fold (screenHandoff.tsx).
  useEffectUntilScreenLeaves(() =>
    startGalleryCollectionSync(() => {
      const next = SaveSystem.shapesSeen;
      setMasks((prev) => (prev.lo === next.lo && prev.hi === next.hi ? prev : next));
    }));

  // Android back returns to the menu instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const wall = useMemo(() => galleryWall(masks), [masks]);
  const rows = useMemo(() => {
    const out: GalleryTile[][] = [];
    for (let i = 0; i < wall.tiles.length; i += layout.columns) {
      out.push(wall.tiles.slice(i, i + layout.columns));
    }
    return out;
  }, [wall, layout.columns]);

  return (
    <View style={[styles.root, { backgroundColor: p.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <HeaderButton
          label="‹"
          icon="back"
          palette={p}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        />
        <Text style={[styles.count, { color: p.inkDim }]}>
          {galleryCountLabel(wall.collected, wall.total)}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: ROW_GAP_DP,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View>
          <TileWall tiles={wall.tiles} layout={layout} rowCount={rows.length} palette={p} />
          {rows.map((row, r) => (
            <View key={r} testID="gallery-row" style={[styles.row, { gap: layout.columnGap }]}>
              {row.map((tile) => (
                <TileCell
                  key={tile.id}
                  id={tile.id}
                  name={tile.name}
                  collected={tile.collected}
                  tileSize={layout.tileSize}
                  cellWidth={layout.cellWidth}
                  palette={p}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Vertical gap between two rows of tiles, dp. OWNER-PICKED STARTING VALUE. */
const ROW_GAP_DP = 16; // OWNER-PICKED STARTING VALUE
/** Gap between a tile and its name, dp. OWNER-PICKED STARTING VALUE. */
const NAME_GAP_DP = 6; // OWNER-PICKED STARTING VALUE
/** The name's line box, dp (reserved on every tile so rows stay aligned). */
const NAME_LINE_DP = 16; // OWNER-PICKED STARTING VALUE

/** One grid cell's height, dp: the tile, the gap and the name line. */
function cellHeight(tileSize: number): number {
  return tileSize + NAME_GAP_DP + NAME_LINE_DP;
}

/**
 * Every tile's silhouette in ONE Svg, laid under the grid (same size, no
 * pointer events). Tile i sits at its cell's column and row from
 * `galleryLayout`, centred in the cell and snapped to the device pixel grid as
 * the per-tile views were (galleryTileOrigin), inset by half the outline so a
 * stroke is never clipped; both states draw the same path in the same box, so
 * a shape keeps its size when it is collected.
 */
const TileWall = React.memo(function TileWall({
  tiles,
  layout,
  rowCount,
  palette,
}: {
  tiles: readonly GalleryTile[];
  layout: GalleryLayout;
  rowCount: number;
  palette: Palette;
}) {
  const { columns, cellWidth, columnGap, tileSize } = layout;
  const rowPitch = cellHeight(tileSize) + ROW_GAP_DP;
  const pixelRatio = PixelRatio.get();
  const inset = GALLERY_OUTLINE_DP / 2;
  const size = tileSize - GALLERY_OUTLINE_DP;
  return (
    <Svg
      pointerEvents="none"
      width={columns * cellWidth + (columns - 1) * columnGap}
      height={rowCount * rowPitch}
      style={styles.wall}
    >
      {tiles.map((tile, i) => {
        const origin = galleryTileOrigin(i, layout, rowPitch, pixelRatio);
        const x = origin.x + inset;
        const y = origin.y + inset;
        const d = galleryTilePath(tile.id, size);
        return tile.collected ? (
          <SvgPath
            key={tile.id}
            d={d}
            transform={`translate(${x} ${y})`}
            fill={palette.ink}
            fillRule="evenodd"
          />
        ) : (
          <SvgPath
            key={tile.id}
            d={d}
            transform={`translate(${x} ${y})`}
            fill="none"
            stroke={palette.pipSpent}
            strokeWidth={GALLERY_OUTLINE_DP}
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
});

/**
 * One grid cell: a View with no press handler, the tile's box (drawn by
 * TileWall underneath) and, when collected, the name under it.
 */
const TileCell = React.memo(function TileCell({
  id,
  name,
  collected,
  tileSize,
  cellWidth,
  palette,
}: {
  id: string;
  name: string;
  collected: boolean;
  tileSize: number;
  cellWidth: number;
  palette: Palette;
}) {
  return (
    <View
      testID={`gallery-tile-${id}`}
      accessible={collected}
      accessibilityLabel={collected ? name : undefined}
      style={[styles.cell, { width: cellWidth, height: cellHeight(tileSize), paddingTop: tileSize }]}
    >
      {collected && (
        <Text numberOfLines={1} style={[styles.name, { color: palette.inkDim }]}>
          {name}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Same header geometry as the game screen's (GameScreen.tsx styles.header).
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 12,
  },
  count: {
    ...Type.galleryCount,
  },
  row: {
    flexDirection: 'row',
    marginBottom: ROW_GAP_DP,
  },
  wall: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  cell: {
    alignItems: 'center',
  },
  name: {
    marginTop: NAME_GAP_DP,
    ...Type.galleryName,
    lineHeight: NAME_LINE_DP,
  },
});
