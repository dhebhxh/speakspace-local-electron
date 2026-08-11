import { AgentPageMessage } from '../AgentPageTypes';

type Props = { history: AgentPageMessage[]; error: string };

export default function AgentConversation({ history, error }: Props) {
  return (
    <section className="agent-conversation">
      <header>
        <span>LOCAL AGENT</span>
        <h2>任务与回答</h2>
      </header>
      {error && (
        <p className="agent-error" role="alert">
          {error}
        </p>
      )}
      {history.length === 0 ? (
        <div className="agent-conversation-empty">
          <strong>还没有执行任务</strong>
          <span>助理目前只会搜索和读取你选择的工作空间。</span>
        </div>
      ) : (
        <div className="agent-message-list">
          {history.map((message) => (
            <article className={message.role} key={message.id}>
              <span>{message.role === 'user' ? '你的任务' : '助理回答'}</span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
