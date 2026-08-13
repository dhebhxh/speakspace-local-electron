import { useTranslation } from 'react-i18next';
import { AgentPageMessage } from '../AgentPageTypes';

type Props = { history: AgentPageMessage[]; error: string };

export default function AgentConversation({ history, error }: Props) {
  const { t } = useTranslation();

  return (
    <section className="agent-conversation">
      <header>
        <span>LOCAL AGENT</span>
        <h2>{t('agent.conversation.title')}</h2>
      </header>
      {error && (
        <p className="agent-error" role="alert">
          {error}
        </p>
      )}
      {history.length === 0 ? (
        <div className="agent-conversation-empty">
          <strong>{t('agent.conversation.empty.title')}</strong>
          <span>{t('agent.conversation.empty.description')}</span>
        </div>
      ) : (
        <div className="agent-message-list">
          {history.map((message) => (
            <article className={message.role} key={message.id}>
              <span>
                {message.role === 'user'
                  ? t('agent.conversation.user')
                  : t('agent.conversation.assistant')}
              </span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
