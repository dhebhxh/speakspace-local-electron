import AgentConversation from './components/AgentConversation';
import AgentTaskPanel from './components/AgentTaskPanel';
import AgentTimeline from './components/AgentTimeline';
import useAgentPage from './useAgentPage';
import './AgentPage.css';

export default function AgentPage() {
  const agent = useAgentPage();

  return (
    <section className="agent-page">
      <header className="agent-page-header">
        <div>
          <span>BOUNDED LOCAL AUTOMATION</span>
          <h1>智能助理</h1>
          <p>让本地模型分步骤查找笔记；每次最多执行 6 步，可随时取消。</p>
        </div>
        <strong>只读笔记权限</strong>
      </header>
      <div className="agent-page-grid">
        <aside>
          <AgentTaskPanel
            onCancel={agent.cancel}
            onStart={agent.start}
            onWorkspaceChange={agent.selectWorkspace}
            running={agent.page.running}
            workspaceId={agent.workspaceId}
            workspaces={agent.workspaces}
          />
          <AgentTimeline
            running={agent.page.running}
            status={agent.page.status}
            steps={agent.page.steps}
          />
        </aside>
        <AgentConversation
          error={agent.page.error}
          history={agent.page.history}
        />
      </div>
    </section>
  );
}
