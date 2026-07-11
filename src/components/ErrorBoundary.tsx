import { Component, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render errors in a subtree so one diagram type can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface the error in the Tauri dev terminal (no-op outside Tauri).
    const msg = `${error.message}\n${error.stack ?? ""}`;
    invoke("report_error", { message: msg }).catch(() => {});
  }

  componentDidUpdate(prevProps: Props) {
    // Clear a caught error once the children change (e.g. the user fixed the
    // DBML in the same tab) so a corrected diagram isn't stuck on the error UI.
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            height: "100%",
            overflow: "auto",
            padding: 20,
            color: "#ff6363",
            backgroundColor: "#1b1b20",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Render error:</strong>
          {"\n\n"}
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
