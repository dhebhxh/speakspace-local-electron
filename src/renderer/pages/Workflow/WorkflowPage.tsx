import { useEffect, useState } from "react";
import { KnowledgeTemplateCard } from "./components/KnowledgeTemplateCard";
import { KnowledgeTemplate } from "../../../main/entities/KnowledgeTemplate";
import { KnowledgeTemplateFormPage } from "./KnowledgeTemplateFormPage";


export function WorkflowPage() {

    // 现有问题说明：IPC 传回的类实例会被结构化克隆为普通对象，后续调用 getId/getName 等实体方法会失败，应使用纯数据 DTO。

    const [knowledgeTemplates, setKnowledgeTemplates] = useState<KnowledgeTemplate[]>([]);

    const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");

    const [editingTemplate, setEditingTemplate] = useState<KnowledgeTemplate | null>(null);

    useEffect(()=>{
        async function loadKnowledgeTemplates() {
            const knowledgeTemplateList = await window.electron.workflow.getKnowledgeTemplateList();
            setKnowledgeTemplates(knowledgeTemplateList);
        }
        loadKnowledgeTemplates();
    },[]);

    function handleUpdate(knowledgeTemplate: KnowledgeTemplate) {
        setEditingTemplate(knowledgeTemplate);
        setPageMode("edit");


    }

    function handleDelete(knowledgeTemplate: KnowledgeTemplate) {
        // Implement delete functionality here
    }

    function handleCreateTemplate() {
        setPageMode("create");
    }

    return (
        <div>
            {
                pageMode === "list" && 
                <>
                    <button onClick={handleCreateTemplate}>
                        create new knowledge template
                    </button>
                    {
                        knowledgeTemplates.map(
                            (knowledgeTemplate) => (
                                <KnowledgeTemplateCard
                                    key={knowledgeTemplate.getId()}
                                    knowledgeTemplate={knowledgeTemplate}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            )
                        )
                    }
                </>
            }

            {
                pageMode === "create" &&
                <KnowledgeTemplateFormPage/>
            }

            {
                pageMode === "edit" &&
                // 现有问题说明：下面的 KnowledgeTemplateFormPage JSX 未闭合且缺少必填 props，当前文件存在语法错误。
                <KnowledgeTemplateFormPage
                    
            }
        </div>
    )
}
