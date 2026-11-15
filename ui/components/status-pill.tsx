import { Text, View } from "nsh";
import type { Signal } from "nsh";
import { transitionStyle } from "../lib/motion";
import { connectionColor, connectionLabel, type ConnectionState } from "../state/connection";
import { motion, type } from "../theme";
import { Icon, type IconName } from "./icon";

export function StatusPill(props: { connection: Signal<ConnectionState> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
      <Icon name={statusIcon(props.connection())} size={16} />
      <Text
        testID="connection-status"
        style={{
          color: connectionColor(props.connection()),
          fontSize: type.body,
          fontWeight: "600",
          numberOfLines: 1,
          textOverflow: "ellipsis",
          flex: 1,
          ...transitionStyle("color", motion.duration),
        }}
      >
        {connectionLabel(props.connection())}
      </Text>
    </View>
  );
}

function statusIcon(state: ConnectionState): IconName {
  switch (state.kind) {
    case "idle":
      return "wifi-off";
    case "connecting":
      return "loader";
    case "need_profile":
      return "wifi-cog";
    case "connected":
      return "wifi-check";
    case "error":
      return "wifi-x";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
