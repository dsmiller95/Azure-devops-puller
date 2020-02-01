import fetch from 'node-fetch';
import * as azureDevApi from "azure-devops-node-api";
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { ConnectionData } from 'azure-devops-node-api/interfaces/LocationsInterfaces';

interface ReturnType {
    success: boolean;
    prs?: GitPullRequest[];
    token?: string;
    connection?: ConnectionData;
}

const repositoryID = '654d2cf2-fe1f-4f47-9eee-4a92f00c2174';
exports.handler = async (event: any): Promise<ReturnType> => {
    const orgUrl = "https://dev.azure.com/symplr";
    const projectName = "Provider Management";

    let token = process.env.AZURE_PERSONAL_ACCESS_TOKEN;
    if(!token){
        return {success: false};
    }

    let authHandler = azureDevApi.getPersonalAccessTokenHandler(token); 
    
    let connection = new azureDevApi.WebApi(orgUrl, authHandler);

    const result = await connection.connect();
    const gitApi = await connection.getGitApi();
    const prs = await gitApi.getPullRequests(repositoryID, {
        repositoryId: repositoryID
    }, projectName);
    
    return {
        success: true,
        prs,
        connection: result
    };
};
