import { Component } from 'react'

// Every tab (Accounts/Campaigns/Alerts/Leads/Billing) stays mounted at all
// times — only hidden via CSS — so a crash in a tab you're not even looking
// at would otherwise take the whole dashboard down. This boundary contains
// that to just the one section.
export default class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error(`[${this.props.label || 'view'}] crashed:`, error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="no-data-box" style={{ color: 'var(--red)', textAlign: 'left' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {this.props.label || 'This section'} hit an error and stopped rendering.
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}
