import { Text } from "nsh";
import type { Signal } from "nsh";
import { connectionColor, connectionLabel, type ConnectionState } from "../state/connection";
import { type } from "../theme";

export function StatusPill(props: { connection: Signal<ConnectionState> }) {
  return (
    <Text
      testID="connection-status"
      style={{
        color: connectionColor(props.connection()),
        fontSize: type.body,
        fontWeight: "600",
        numberOfLines: 1,
        textOverflow: "ellipsis",
      }}
    >
      {connectionLabel(props.connection())}
    </Text>
  );
}
