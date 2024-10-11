document.addEventListener('DOMContentLoaded', () => {
  /**
   * This function is triggered when the DOM is fully loaded. 
   * It retrieves the stored JIRA URL and auth token from Chrome storage and pre-fills the form fields.
   */
  chrome.storage.sync.get(['jiraUrl', 'authToken'], (result) => {
    if (result.jiraUrl) {
      document.getElementById('jiraUrl').value = result.jiraUrl;
    }

    if (result.authToken) {
      document.getElementById('authToken').value = result.authToken;
    }
  });
});

document.getElementById('save').addEventListener('click', () => {
  /**
   * This function is triggered when the user clicks the "Save Settings" button.
   * It saves the entered JIRA URL and auth token into Chrome storage.
   * If both fields are filled, the settings are saved and the user is redirected to the Create Ticket page.
   * Otherwise, an alert is shown prompting the user to fill in both fields.
   */
  const jiraUrl = document.getElementById('jiraUrl').value;
  const authToken = document.getElementById('authToken').value;

  if (jiraUrl && authToken) {
    chrome.storage.sync.set({ jiraUrl, authToken }, () => {
      alert('Settings saved successfully!');
      
      // Automatically redirects to the Create Ticket page (popup.html)
      window.location.href = chrome.runtime.getURL("src/popup/popup.html");
    });
  } else {
    alert('Please fill in both fields.');
  }
});
