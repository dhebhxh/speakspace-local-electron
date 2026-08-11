export type WorkspaceTemplate = {
  id: number;
  name: string;
  prompt: string;
};

type WorkflowApi = {
  getKnowledgeTemplateList(): Promise<WorkspaceTemplate[]>;
  generateKnowledgeOutput(noteId: number, templateId: number): Promise<unknown>;
};

/** 工作空间只通过 preload 接口请求生成，不直接访问模型或数据库。 */
export class WorkspaceWorkflowController {
  private readonly api: WorkflowApi;

  public constructor(api: WorkflowApi = window.electron.workflow) {
    this.api = api;
  }

  public listTemplates(): Promise<WorkspaceTemplate[]> {
    return this.api.getKnowledgeTemplateList();
  }

  public async generate(noteId: number, templateId: number): Promise<void> {
    await this.api.generateKnowledgeOutput(noteId, templateId);
  }
}
