import React from 'react';
import JobBoardComponent from '../components/handyman/JobBoard';

const JobBoard = () => {
  return (
    <div className="job-board-page">
      <div className="container">
        <div className="page-header">
          <h1>Job Board</h1>
          <p>Browse and apply for available handyman jobs in Singapore</p>
        </div>
        
        <JobBoardComponent />
      </div>
    </div>
  );
};

export default JobBoard;