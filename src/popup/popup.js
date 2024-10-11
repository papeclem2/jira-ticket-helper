async function loadJiraProjects(jiraUrl, authToken) {
  /**
   * This function fetches the list of JIRA projects and fills the project dropdown.
   * It also restores the last selected project from Chrome storage.
   */
  if (!authToken) {
    alert('Please configure your JIRA API token.');
    window.location.href = chrome.runtime.getURL("src/options/options.html");
    return;
  }

  try {
    const response = await fetch(`${jiraUrl}/rest/api/3/project`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const projects = await response.json();
      const projectSelect = document.getElementById('project');

      projectSelect.innerHTML = '';

      chrome.storage.sync.get(['lastSelectedProject'], (result) => {
        const lastSelectedProject = result.lastSelectedProject;

        projects.forEach(project => {
          const option = document.createElement('option');
          option.value = project.key;
          option.textContent = project.name;
          if (lastSelectedProject && project.key === lastSelectedProject) {
            option.selected = true;
          }
          projectSelect.appendChild(option);
        });

        console.log('Project dropdown filled successfully.');
      });
    } else {
      const errorData = await response.json();
      console.error('Failed to load JIRA projects:', errorData);
      alert('Failed to load JIRA projects.');
    }
  } catch (error) {
    console.error('Error loading JIRA projects:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  /**
   * This function runs when the DOM is fully loaded.
   * It loads the default description from a file and retrieves stored JIRA settings.
   */
  const descriptionField = document.getElementById('description');

  try {
    const response = await fetch('../data/default_description.txt');
    if (response.ok) {
      const defaultDescription = await response.text();
      if (!descriptionField.value) {
        descriptionField.value = defaultDescription;
      }
    } else {
      console.error('Failed to load default description file.');
    }
  } catch (error) {
    console.error('Error loading default description:', error);
  }

  chrome.storage.sync.get(['jiraUrl', 'authToken'], async (result) => {
    if (!result.jiraUrl) {
      await findJiraTabAndSaveUrl();
      chrome.storage.sync.get(['jiraUrl'], async (newResult) => {
        if (newResult.jiraUrl) {
          await loadJiraProjects(newResult.jiraUrl, result.authToken);
        } else {
          alert('Please open your JIRA instance in one of the tabs.');
        }
      });
    } else {
      await loadJiraProjects(result.jiraUrl, result.authToken);
    }
  });
});

async function findJiraTabAndSaveUrl() {
  /**
   * This function finds a tab with a JIRA instance open and saves its URL in Chrome storage.
   */
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const jiraTab = tabs.find(tab => tab.url && tab.url.includes('atlassian.net'));

      if (jiraTab) {
        const jiraUrl = new URL(jiraTab.url).origin;
        chrome.storage.sync.set({ jiraUrl }, () => {
          console.log('JIRA URL found and saved:', jiraUrl);
          resolve(jiraUrl);
        });
      } else {
        alert('No JIRA tab found. Please open your JIRA instance.');
        reject('No JIRA tab found.');
      }
    });
  });
}

async function getUserAccountId(jiraUrl, authToken) {
  /**
   * This function retrieves the current user's accountId from JIRA.
   */
  try {
    const response = await fetch(`${jiraUrl}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      return userData.accountId;
    } else {
      alert('Failed to retrieve accountId. Please check your JIRA settings.');
    }
  } catch (error) {
    console.error('Error fetching accountId:', error);
  }
}

document.getElementById('createTicket').addEventListener('click', async () => {
  /**
   * This function is triggered when the user clicks the "Create Ticket" button.
   * It retrieves the title, description, and selected project, and sends a request to create a JIRA ticket.
   */
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const projectKey = document.getElementById('project').value;

  if (title && description && projectKey) {
    chrome.storage.sync.get(['jiraUrl', 'authToken'], async (result) => {
      if (result.jiraUrl && result.authToken) {
        const accountId = await getUserAccountId(result.jiraUrl, result.authToken);
        if (accountId) {
          await createJiraTicket(title, description, projectKey, result.jiraUrl, result.authToken, accountId);
        }
      } else {
        alert('Please configure your JIRA settings first.');
        window.location.href = chrome.runtime.getURL("src/options/options.html");
      }
    });
  } else {
    alert('Please fill in all fields.');
  }
});

function convertToJiraIcons(text) {
  /**
   * This function replaces specific text shortcuts (e.g. :bug:) with corresponding JIRA icons or emojis.
   */
  const iconMappings = {
    ':bug:': '🐛',
    ':check:': '✅',
    ':fire:': '🔥',
    ':star:': '⭐',
    ':warning:': '⚠️'
  };

  return text.replace(/:[a-zA-Z]+:/g, (match) => iconMappings[match] || match);
}

async function createJiraTicket(title, description, projectKey, jiraUrl, authToken, accountId) {
  /**
   * This function creates a JIRA ticket using the provided title, description, project key, and accountId.
   * It sends the data to the JIRA API and opens the created ticket's URL if successful.
   */
  const issueData = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: convertToJiraIcons(description)
              }
            ]
          }
        ]
      },
      issuetype: { name: "Task" }
    }
  };

  try {
    const response = await fetch(`${jiraUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueData)
    });

    if (response.ok) {
      const responseData = await response.json();
      const issueKey = responseData.key;
      const issueUrl = `${jiraUrl}/browse/${issueKey}`;

      alert(`Ticket created successfully! You can view it at: ${issueUrl}`);
      chrome.tabs.create({ url: issueUrl });
    } else {
      const errorData = await response.json();
      console.error('Error details:', JSON.stringify(errorData, null, 2));
      alert(`Failed to create ticket: ${errorData.errorMessages ? errorData.errorMessages.join(', ') : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    alert('An error occurred while creating the ticket.');
  }
}

document.getElementById('project').addEventListener('change', () => {
  /**
   * This function is triggered when the user selects a project from the dropdown.
   * It stores the selected project key in Chrome storage for future use.
   */
  const selectedProjectKey = document.getElementById('project').value;
  chrome.storage.sync.set({ lastSelectedProject: selectedProjectKey }, () => {
    console.log('Last selected project saved:', selectedProjectKey);
  });
});
