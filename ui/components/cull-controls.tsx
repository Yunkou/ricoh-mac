import { Text, View } from "nsh";
import { copy } from "../copy";
import { marksSummary, normalizeFlag, normalizeRating, type CullFlag } from "../state/cull";
import type { AlbumPhoto } from "../state/app-model";
import { color, focusRing, font, radius, space, type } from "../theme";

export function CullControls(props: {
  photo: () => AlbumPhoto;
  variant: "compact" | "detail";
  onRate: (rating: number) => void;
  onFlag: (flag: CullFlag) => void;
}) {
  const photo = props.photo();
  const rating = normalizeRating(photo.rating);
  const flag = normalizeFlag(photo.flag);
  const compact = props.variant === "compact";
  const prefix = compact ? `cull-${photo.id}` : "cull";
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: compact ? "flex-start" : "center",
        gap: compact ? 2 : space.md,
        width: compact ? "100%" : undefined,
      }}
    >
      <Text
        testID={`${prefix}-summary`}
        style={{
          fontFamily: font.family,
          color: flag === "rejected" ? color.danger : flag === "picked" ? color.success : color.secondary,
          fontSize: type.badge,
          lineHeight: type.lineBadge,
          numberOfLines: 1,
        }}
      >
        {marksSummary(rating, flag)}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 0 : 2 }}>
        {[1, 2, 3, 4, 5].map((value) => (
          <StarButton
            testID={`${prefix}-rating-${value}`}
            label={copy.rateStar(value)}
            filled={rating >= value}
            compact={compact}
            onPress={() => props.onRate(value)}
          />
        ))}
        {!compact ? (
          <StarButton
            testID={`${prefix}-rating-0`}
            label={copy.clearRating}
            filled={false}
            compact={false}
            glyph="×"
            onPress={() => props.onRate(0)}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        <FlagButton
          testID={`${prefix}-flag-picked`}
          label={copy.flagPicked}
          active={flag === "picked"}
          tone="picked"
          compact={compact}
          onPress={() => props.onFlag("picked")}
        />
        <FlagButton
          testID={`${prefix}-flag-rejected`}
          label={copy.flagRejected}
          active={flag === "rejected"}
          tone="rejected"
          compact={compact}
          onPress={() => props.onFlag("rejected")}
        />
        {!compact ? (
          <FlagButton
            testID={`${prefix}-flag-none`}
            label={copy.clearFlag}
            active={false}
            tone="none"
            compact={false}
            onPress={() => props.onFlag("none")}
          />
        ) : null}
      </View>
    </View>
  );
}

function StarButton(props: {
  testID: string;
  label: string;
  filled: boolean;
  compact: boolean;
  glyph?: string;
  onPress: () => void;
}) {
  const size = props.compact ? 18 : 28;
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.label}
      focusable={true}
      onPress={props.onPress}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.control,
      }}
      hoverStyle={{ backgroundColor: color.segment }}
      focusVisibleStyle={focusRing}
    >
      <Text
        style={{
          fontFamily: font.family,
          color: props.filled ? color.accent : color.tertiary,
          fontSize: props.compact ? 12 : 16,
          lineHeight: props.compact ? 16 : 20,
        }}
      >
        {props.glyph ?? (props.filled ? "★" : "☆")}
      </Text>
    </View>
  );
}

function FlagButton(props: {
  testID: string;
  label: string;
  active: boolean;
  tone: "picked" | "rejected" | "none";
  compact: boolean;
  onPress: () => void;
}) {
  const activeColor =
    props.tone === "picked" ? color.success : props.tone === "rejected" ? color.danger : color.secondary;
  return (
    <View
      role="button"
      testID={props.testID}
      accessibilityLabel={props.label}
      focusable={true}
      onPress={props.onPress}
      style={{
        paddingHorizontal: props.compact ? 4 : space.sm,
        paddingVertical: props.compact ? 1 : 4,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: props.active ? activeColor : color.border,
        backgroundColor: props.active ? color.segment : "transparent",
      }}
      hoverStyle={{ backgroundColor: color.segment }}
      focusVisibleStyle={focusRing}
    >
      <Text
        style={{
          fontFamily: font.family,
          color: props.active ? activeColor : color.secondary,
          fontSize: props.compact ? type.badge : type.meta,
          lineHeight: props.compact ? type.lineBadge : type.lineMeta,
        }}
      >
        {props.label}
      </Text>
    </View>
  );
}
