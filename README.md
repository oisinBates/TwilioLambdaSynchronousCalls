# TwilioLambdaSynchronousCalls

This is a short example of handling a sequential task with an AWS Lambda function. The task is to call a list of phone numbers, 
synchronously, using the Twilio API.

In order to make handle status callbacks, it was necessary to map the Lambda functionto an API endpoint with AWS API gateway, 
while data was stored in a MySQL database on an AWS EC2 instance.

The call process is initiated by a post or get request to the API Gateway's url.
At the beginning of the call process, the function retrieves the max and minimum ids of the phones to  call, 
and the phone number of the first contact. As each call is completed, it sends a callback with its status. 
This call status is written to the database (along with the call's duration and start/finish times), 
and if the id of the call is less than the max id, the next call is made.
