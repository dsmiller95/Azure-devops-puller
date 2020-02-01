import fetch from 'node-fetch';
import * as azureDevApi from "azure-devops-node-api";
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';

interface ReturnType {
    success: boolean;
    prs?: GitPullRequest[];
}

const repositoryID = '654d2cf2-fe1f-4f47-9eee-4a92f00c2174';
exports.handler = async (event: any): Promise<ReturnType> => {
    let orgUrl = "https://symplr.visualstudio.com/Provider%20Management";

    let token = process.env.AZURE_PERSONAL_ACCESS_TOKEN;
    if(!token){
        return {success: false};
    }

    let authHandler = azureDevApi.getPersonalAccessTokenHandler(token); 
    let connection = new azureDevApi.WebApi(orgUrl, authHandler);

    const gitApi = await connection.getGitApi();
    const prs = await gitApi.getPullRequests(repositoryID, {
        repositoryId: repositoryID
    })
    
    return {
        success: true,
        prs
    };
};
