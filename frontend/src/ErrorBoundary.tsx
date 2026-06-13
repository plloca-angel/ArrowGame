import { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crash:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.msg}>{this.state.error.message}</Text>
            {this.state.error.stack ? (
              <Text style={styles.stack}>{this.state.error.stack}</Text>
            ) : null}
          </ScrollView>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.btnLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#05060a",
    padding: 24,
    paddingTop: 60,
  },
  title: {
    color: "#ff2bd6",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },
  scroll: { flex: 1, marginBottom: 16 },
  msg: { color: "#fff", fontSize: 14, marginBottom: 12 },
  stack: { color: "#888", fontSize: 11, fontFamily: "monospace" },
  btn: {
    backgroundColor: "#00f0ff",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnLabel: { color: "#02141a", fontWeight: "800" },
});
