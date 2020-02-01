const repositoryID = '654d2cf2-fe1f-4f47-9eee-4a92f00c2174';
​
function getPRs(){
    return fetch(`https://symplr.visualstudio.com/Provider%20Management/_apis/git/repositories/${repositoryID}/pullrequests?api-version=5.1&$top=500`)
        .then(x => x.json())
        .then(x => x.value);
}
​
function getHistoricPRs(){
    return fetch(`https://symplr.visualstudio.com/Provider%20Management/_apis/git/repositories/${repositoryID}/pullrequests?api-version=5.1&$top=500&searchCriteria.status=completed`)
        .then(x => x.json())
        .then(x => x.value);
}
​
function getThreads(prID) {
    return fetch(`https://symplr.visualstudio.com/Provider%20Management/_apis/git/repositories/${repositoryID}/pullrequests/${prID}/threads?api-version=5.1`)
        .then(x => x.json())
        .then(x => {
            return x.value
        })
}
​
function getCommitsForPR(prID) {
    return fetch(`https://symplr.visualstudio.com/Provider%20Management/_apis/git/repositories/${repositoryID}/pullRequests/${prID}/commits?api-version=5.1`)
        .then(x => x.json())
        .then(x => x.value);
}
​
function getThreadsByPr(prList){
    var threadRequests = prList
        .map(pr => getThreads(pr.pullRequestId)
            .then(threads => ({threads, pr: pr }) )
        );
    return Promise.all(threadRequests);
}
​
function isActiveCommentThread(thread){
    return thread.status === 'active' && thread.comments.some(comment => comment.commentType === 'text') && thread.comments[0].content;
}
​
//if stale, returns how long it has been stale in hours
function isStaleThread(threadDate, commitDates){
    commitDates.sort();
    for(var commitDate of commitDates) {
        if(commitDate > threadDate) {
            //if more than X hours have passed since the commit directly following the thread's date, it is stale
            var howOldIsCommitInHours = (new Date() - commitDate) / (1000 * 60 * 60);
            if(howOldIsCommitInHours > 16){
                return howOldIsCommitInHours;
            }
            return false;
        }
    }
    return false;    
}
​
function filterOutNonStaleThreads(prDatum){
    var commitDates = prDatum.commits.map(commit => new Date(commit.committer.date));
    prDatum.threads = prDatum.threads
        .map(thread => ({...thread, howStale: isStaleThread(new Date(thread.lastUpdatedDate), commitDates)}))
        .filter(thread => thread.howStale);
}
​
function getAllStaleThreads(){
    return getPRs()
        .then(prs => getThreadsByPr(prs))
        .then(threadData => threadData.map(prThreadDatum => ({
                pr: prThreadDatum.pr,
                threads: prThreadDatum.threads.filter(thread => isActiveCommentThread(thread))
            })).filter(data => data.threads.length > 0)
        )
        .then(prData => Promise.all(
            prData.map(datum => 
                getCommitsForPR(datum.pr.pullRequestId).then(commits => ({pr: datum.pr, threads: datum.threads, commits}))
            )))
        .then(prData => {
            prData.forEach(datum => {
                filterOutNonStaleThreads(datum);
            });
            return prData;
        })
        .then(prData => prData.filter(datum => datum.threads.length > 0));
}
​
function processStaleThreadsIntoMarkdown(staleThreadData){
    output = "*STALE THREADS:*\n";
    for(var prData of staleThreadData){
        output += formatLink(getPRLink(prData.pr), `*${prData.pr.title}*`) + ':\n'
        for(var thread of prData.threads){
            output += `\t* ${getFormatFromHours(thread.howStale)} stale: "${thread.comments[0].content}"\n`;
        }
        output += '\n';
    }
    return output;
}
​
function getFormatFromHours(hrs){
    var days = Math.floor(hrs / 24);
    var remainderHrs = Math.round(hrs % 24);
    if(days > 0){
        return `${days} days, ${remainderHrs}hrs`;
    }
    return `${remainderHrs}hrs`;
}
​
function getFormattedStaleThreadsData(){
    getAllStaleThreads()
    .then(data => processStaleThreadsIntoMarkdown(data))
        .then(console.log);
}
​
function getPRLink(prObj){
    return `https://symplr.visualstudio.com/Provider%20Management/_git/symplr-cactus-ui/pullrequest/${prObj.pullRequestId}`;
}
​
function formatLink(url, string){
    return string + ': ' + url;
}
​
getFormattedStaleThreadsData()