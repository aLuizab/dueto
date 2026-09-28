/** Isola falhas de renderização: uma tela ou aba com erro não derruba o resto do app. */
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; area: string; resetKey?: string }
interface State { erro: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error) {
    console.error(`[${this.props.area}]`, erro);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.erro) this.setState({ erro: null });
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm">
        <div className="font-semibold text-bad">Não foi possível exibir {this.props.area}.</div>
        <p className="text-text-2 mt-1">O restante do app continua funcionando. Detalhe técnico: <span className="mono">{this.state.erro.message}</span></p>
        <p className="text-text-3 mt-1">Se o erro citar uma tabela fiscal, confira em Configurações → Tabelas fiscais se há uma vigência ativa.</p>
        <button className="btn btn-secondary btn-sm mt-2" onClick={() => this.setState({ erro: null })}>Tentar de novo</button>
      </div>
    );
  }
}
